/**
 * Photo-evidence verification.
 *
 * Real mode: the photo is downscaled on-device, then sent to the `verify-evidence` Edge
 * Function, which checks it with Google Gemini (vision) and – only if it passes – awards
 * the quest on the server. The client never grants itself rewards.
 *
 * Demo mode: a clearly-labelled simulation for the local sandbox. No photo leaves the device.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { z } from 'zod';
import type { Quest } from '../types';
import { supabase } from './supabase/client';
import { deviceTimeZone } from './cloud';

export interface ServerReward {
  duplicate: boolean;
  xp_gained: number;
  total_xp: number;
  streak: number;
  new_landmark: boolean;
  party_size?: number;
  collectible: { id: string; name: string; theme: string; rarity: string; landmark_name: string; unlocked_at: string } | null;
}

export type VerifyOutcome =
  | { kind: 'accepted'; feedback: string; observations: string | null; confidence: number; reward: ServerReward | null; source: 'gemini' | 'demo' }
  | { kind: 'rejected'; feedback: string; observations: string | null; confidence: number; source: 'gemini' | 'demo' }
  | { kind: 'error'; code: VerifyErrorCode; message: string };

export type VerifyErrorCode = 'unavailable' | 'rate_limited' | 'quest_rate_limited' | 'daily_limit' | 'network' | 'auth' | 'invalid' | 'image';

const RewardSchema = z.object({
  duplicate: z.boolean(),
  xp_gained: z.number(),
  total_xp: z.number(),
  streak: z.number(),
  new_landmark: z.boolean(),
  party_size: z.number().optional(),
  collectible: z
    .object({ id: z.string(), name: z.string(), theme: z.string(), rarity: z.string(), landmark_name: z.string(), unlocked_at: z.string() })
    .nullable(),
});

const ResponseSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
  confidence: z.number(),
  observations: z.string().optional(),
  feedback: z.string(),
  reward: RewardSchema.optional(),
});

const ERROR_TEXT: Record<VerifyErrorCode, string> = {
  unavailable: 'Photo checks are temporarily unavailable. Your photo is still here – try again in a little while.',
  rate_limited: 'You’ve submitted a lot of photos recently. Take a breather and try again in a bit.',
  quest_rate_limited: 'Nice pace! Wait a few seconds between quests, then submit again.',
  daily_limit: 'You’ve hit today’s quest limit. Come back tomorrow for more!',
  network: 'Couldn’t reach Thaw. Check your connection – your photo is still here.',
  auth: 'Your session expired. Please sign in again.',
  invalid: 'Something about this quest couldn’t be submitted. Try another quest.',
  image: 'That photo couldn’t be read. Try taking it again.',
};

const MAX_EDGE = 1280;

/** Downscale + JPEG-encode so uploads are small and fast (and EXIF/location is dropped). */
export async function prepareImage(uri: string): Promise<{ base64: string; mimeType: 'image/jpeg' } | null> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    // Only ever shrink, along the longer edge.
    let ref = original;
    if (Math.max(original.width, original.height) > MAX_EDGE) {
      const ctx = ImageManipulator.manipulate(original);
      ctx.resize(original.width >= original.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      ref = await ctx.renderAsync();
    }
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    return out.base64 ? { base64: out.base64, mimeType: 'image/jpeg' } : null;
  } catch {
    return null;
  }
}

function codeFromStatus(status: number | undefined, body: unknown): VerifyErrorCode {
  const err = (body as { error?: string } | null)?.error ?? '';
  if (err === 'verifier_unavailable' || status === 503 || status === 502) return 'unavailable';
  if (err === 'quest_rate_limited') return 'quest_rate_limited';
  if (err === 'daily_limit') return 'daily_limit';
  if (err === 'rate_limited' || status === 429) return 'rate_limited';
  if (status === 401) return 'auth';
  if (status === 400) return 'invalid';
  return 'network';
}

export async function verifyWithServer(quest: Quest, landmarkName: string, imageUri: string): Promise<VerifyOutcome> {
  if (!supabase) return { kind: 'error', code: 'unavailable', message: ERROR_TEXT.unavailable };
  const img = await prepareImage(imageUri);
  if (!img) return { kind: 'error', code: 'image', message: ERROR_TEXT.image };

  const { data, error } = await supabase.functions.invoke('verify-evidence', {
    method: 'POST',
    body: {
      quest: {
        id: quest.id,
        title: quest.title.slice(0, 80),
        evidence: quest.evidence.slice(0, 300),
        landmarkId: quest.landmarkId,
        landmarkName: landmarkName.slice(0, 80),
        difficulty: quest.difficulty,
        mode: quest.mode,
        collectible: { ...quest.collectible, name: quest.collectible.name.slice(0, 40) },
      },
      image: img,
      timeZone: deviceTimeZone(),
    },
  });

  if (error) {
    // FunctionsHttpError carries the Response in `context`.
    const ctx = (error as { context?: Response }).context;
    let body: unknown = null;
    try {
      body = ctx ? await ctx.json() : null;
    } catch {
      body = null;
    }
    const code = codeFromStatus(ctx?.status, body);
    return { kind: 'error', code, message: ERROR_TEXT[code] };
  }

  const parsed = ResponseSchema.safeParse(data);
  if (!parsed.success) return { kind: 'error', code: 'unavailable', message: ERROR_TEXT.unavailable };
  const r = parsed.data;
  if (r.status === 'rejected') {
    return { kind: 'rejected', feedback: r.feedback, observations: r.observations ?? null, confidence: r.confidence, source: 'gemini' };
  }
  return { kind: 'accepted', feedback: r.feedback, observations: r.observations ?? null, confidence: r.confidence, reward: r.reward ?? null, source: 'gemini' };
}

/** Demo sandbox only: simulated outcome, nothing is analysed or uploaded. */
export async function verifyDemo(outcome: 'accept' | 'reject', delayMs = 1_200): Promise<VerifyOutcome> {
  await new Promise((r) => setTimeout(r, delayMs));
  return outcome === 'accept'
    ? { kind: 'accepted', feedback: 'Demo mode: simulated check passed. No image analysis was performed.', observations: null, confidence: 1, reward: null, source: 'demo' }
    : { kind: 'rejected', feedback: 'Demo mode: simulated rejection. Try again to see the retry flow.', observations: null, confidence: 0, source: 'demo' };
}
