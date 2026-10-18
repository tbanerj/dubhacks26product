/**
 * Gemini client for Thaw: quest generation and photo-evidence checks, both through
 * generateContent on the same key and model. Local quests and a labeled simulated
 * photo check are the fallbacks. The return shapes stay the same either way.
 *
 * Config: EXPO_PUBLIC_GEMINI_API_KEY (placeholder GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE).
 * Production note: a key bundled into the app is extractable; route this through a
 * backend proxy before shipping publicly.
 */
import { z } from 'zod';
import type { Landmark, LatLng, Quest, VerificationResult } from '../types';
import { config } from '../config/env';
import { distanceMeters } from '../game/geo';
import { RawQuestListSchema, validateQuest } from '../game/questSchema';
import { generateLocalQuests, timeOfDay } from '../game/localQuests';

export interface QuestRequest {
  landmarks: Landmark[];
  playerPosition: LatLng;
  localeHint: string;
  regionName: string | null;
  partySize: number;
  preferSolo: boolean;
  mobilityFriendly: boolean;
  now?: Date;
}

export interface QuestBatch {
  quests: Quest[];
  source: 'gemini' | 'local' | 'mixed';
  /** Human-readable note when AI was unavailable or partially rejected. */
  note: string | null;
}

/** Gemini's OpenAPI-subset schema for structured output. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    quests: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          landmarkId: { type: 'STRING' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          instructions: { type: 'ARRAY', items: { type: 'STRING' } },
          soloAlternative: { type: 'STRING', nullable: true },
          mode: { type: 'STRING', enum: ['solo', 'social', 'party'] },
          minParty: { type: 'INTEGER' },
          maxParty: { type: 'INTEGER' },
          durationMin: { type: 'INTEGER' },
          difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
          xp: { type: 'INTEGER' },
          collectible: {
            type: 'OBJECT',
            properties: {
              theme: { type: 'STRING', enum: ['botanical', 'architecture', 'culture', 'hidden', 'cooperative', 'neighborhood'] },
              rarity: { type: 'STRING', enum: ['common', 'uncommon', 'rare', 'legendary'] },
              name: { type: 'STRING' },
            },
            required: ['theme', 'rarity', 'name'],
          },
          evidence: { type: 'STRING' },
          safetyNotes: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['landmarkId', 'title', 'description', 'instructions', 'mode', 'durationMin', 'difficulty', 'collectible', 'evidence'],
      },
    },
  },
  required: ['quests'],
} as const;

function buildPrompt(req: QuestRequest): string {
  const tod = timeOfDay(req.now);
  const places = req.landmarks.map((l) => ({
    landmarkId: l.id,
    name: l.name,
    category: l.category,
    distanceMeters: Math.round(distanceMeters(req.playerPosition, l.coordinate)),
  }));
  return [
    'You design quests for Thaw, a real-world social exploration game that helps people feel less lonely in their city.',
    `Context: region=${req.regionName ?? 'player location'}, locale=${req.localeHint}, local time of day=${tod}, current party size=${req.partySize}.`,
    req.preferSolo ? 'The player prefers solo quests: make every quest mode "solo".' : 'Mix solo, social and party (2-4 players) quests.',
    req.mobilityFriendly ? 'The player prefers low-mobility quests: little walking, no stairs, under 20 minutes.' : '',
    'Write 1-2 quests per place below. Each quest must be specific to what that KIND of place actually offers (category + name), not a generic template.',
    'Rules (hard requirements):',
    '- Public, accessible areas only. No trespassing, restricted areas, roofs, edges, water entry, or isolated spots.',
    '- Never require spending money, sharing contact details or personal info, or photographing strangers. Faces are never required.',
    '- Social/party quests must be optional for strangers ("if someone is happy to") and MUST include a soloAlternative.',
    '- Do not state facts about the place you are not certain of. Do not make cultural, religious or political assumptions or stereotypes.',
    tod === 'night' ? '- It is night: prefer short quests in well-lit public spots, and suggest daylight for anything else.' : '',
    '- Evidence must be a photo of an object, detail, composition, or consenting group arrangement.',
    '- title ≤ 60 chars, description ≤ 200 chars, 1-4 instructions ≤ 180 chars each, collectible.name ≤ 40 chars.',
    '- Use cooperative theme for party quests. XP: easy≈60, medium≈90, hard≈130.',
    'Write in English (UI is English-only for now) but respect local names.',
    `Places: ${JSON.stringify(places)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/** Text parts only. Ignores thought signatures. Throws when the model stopped early or returned nothing. */
export function readGeminiText(json: unknown): string {
  const body = json as GeminiResponse;
  if (body.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${body.promptFeedback.blockReason}`);
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini stopped early (${candidate.finishReason})`);
  }
  const text = (candidate?.content?.parts ?? []).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
  if (!text.trim()) throw new Error('Gemini returned no content');
  return text;
}

async function geminiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as GeminiResponse;
    if (body.error?.message) return body.error.message;
  } catch {
    // Keep the status line when the error body is not JSON.
  }
  return `Gemini HTTP ${res.status}`;
}

async function callGemini(req: QuestRequest, signal: AbortSignal): Promise<unknown> {
  const { apiKey, model, endpoint } = config.gemini;
  if (!apiKey) throw new Error('Gemini not configured');
  const res = await fetch(`${endpoint}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(req) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
        maxOutputTokens: 8192,
      },
    }),
  });
  if (!res.ok) throw new Error(await geminiError(res));
  return JSON.parse(readGeminiText(await res.json())) as unknown;
}

function applyPreferences(quests: Quest[], req: QuestRequest): Quest[] {
  return quests.filter((q) => {
    if (req.preferSolo && q.mode !== 'solo') return false;
    if (req.mobilityFriendly && (q.durationMin > 25 || q.difficulty === 'hard')) return false;
    return true;
  });
}

export function isGeminiConfigured(): boolean {
  return config.gemini.apiKey !== null;
}

/**
 * Generate quests for the given landmarks. Always resolves: falls back to the local
 * generator for any landmark Gemini didn't produce a valid, safe quest for.
 */
export async function generateQuests(req: QuestRequest, timeoutMs = 20_000): Promise<QuestBatch> {
  const local = applyPreferences(generateLocalQuests(req.landmarks, { now: req.now }), req);
  if (!isGeminiConfigured() || req.landmarks.length === 0) {
    return { quests: local, source: 'local', note: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = await callGemini({ ...req, landmarks: req.landmarks.slice(0, 10) }, controller.signal);
    const list = RawQuestListSchema.safeParse(raw);
    if (!list.success) throw new Error('Gemini output did not match the quest list schema');

    const byId = new Map(req.landmarks.map((l) => [l.id, l]));
    const ai: Quest[] = [];
    let rejected = 0;
    for (const item of list.data.quests) {
      const v = validateQuest(item, byId, 'gemini');
      if (v.ok) ai.push(v.quest);
      else rejected++;
    }
    const aiFiltered = applyPreferences(ai, req);
    const covered = new Set(aiFiltered.map((q) => q.landmarkId));
    const fill = local.filter((q) => !covered.has(q.landmarkId));
    const quests = [...aiFiltered, ...fill];
    const source = aiFiltered.length === 0 ? 'local' : fill.length === 0 ? 'gemini' : 'mixed';
    const note =
      aiFiltered.length === 0
        ? 'AI quests were unusable, so Thaw used its built-in quests.'
        : rejected > 0
          ? `${rejected} AI quest${rejected === 1 ? '' : 's'} failed safety or format checks and were replaced.`
          : null;
    return { quests, source, note };
  } catch (e) {
    const msg = controller.signal.aborted ? 'timed out' : e instanceof Error ? e.message : 'unknown error';
    return { quests: local, source: 'local', note: `AI quests unavailable (${msg}). Using built-in quests.` };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Photo evidence ----------

export interface EvidenceImage {
  uri: string;
  base64: string | null;
  mimeType: string;
}

export interface VerifyRequest {
  quest: Quest;
  landmarkName: string;
  image: EvidenceImage;
}

export interface VerifyOptions {
  /** Demo only: lets the judge rehearse the rejection + retry path. */
  demoOutcome?: 'accept' | 'reject';
  timeoutMs?: number;
}

export type VerifyError = { kind: 'network' | 'timeout' | 'server' | 'bad-response' | 'no-image'; message: string };
export type VerifyResponse = { ok: true; result: VerificationResult } | { ok: false; error: VerifyError };

export function isLiveVerificationConfigured(): boolean {
  return isGeminiConfigured();
}

const VerdictSchema = z.object({
  match: z.boolean(),
  confidence: z.number().min(0).max(1),
  observations: z.string().max(400),
  feedback: z.string().max(300),
});

const VERDICT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    match: { type: 'BOOLEAN' },
    confidence: { type: 'NUMBER' },
    observations: { type: 'STRING' },
    feedback: { type: 'STRING' },
  },
  required: ['match', 'confidence', 'observations', 'feedback'],
} as const;

function evidencePrompt(req: VerifyRequest): string {
  return [
    'You are verifying photo evidence for a friendly real-world exploration game.',
    `Quest: "${req.quest.title}" at ${req.landmarkName}.`,
    `Evidence requirement: ${req.quest.evidence}`,
    'Look at the image and decide whether it plausibly satisfies the evidence requirement.',
    'Be generous with creative interpretations. Do not identify any people.',
    'observations: a short description of what is visible, at most 400 characters.',
    'feedback: one encouraging sentence to the player, at most 300 characters.',
  ].join('\n');
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

async function verifyLive(req: VerifyRequest, timeoutMs: number): Promise<VerifyResponse> {
  if (!req.image.base64) return { ok: false, error: { kind: 'no-image', message: 'The photo could not be read for upload.' } };
  const { apiKey, model, endpoint } = config.gemini;
  if (!apiKey) return { ok: false, error: { kind: 'server', message: 'Gemini is not configured.' } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: req.image.mimeType || 'image/jpeg', data: req.image.base64 } },
              { text: evidencePrompt(req) },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: VERDICT_SCHEMA,
          maxOutputTokens: 512,
        },
      }),
    });
    if (!res.ok) return { ok: false, error: { kind: 'server', message: await geminiError(res) } };
    const verdict = VerdictSchema.safeParse(extractJson(readGeminiText(await res.json())));
    if (!verdict.success) return { ok: false, error: { kind: 'bad-response', message: 'Gemini’s answer was unreadable.' } };
    const accepted = verdict.data.match && verdict.data.confidence >= 0.45;
    return {
      ok: true,
      result: {
        accepted,
        confidence: verdict.data.confidence,
        feedback: verdict.data.feedback,
        observations: verdict.data.observations,
        source: 'gemini',
      },
    };
  } catch (e) {
    if (controller.signal.aborted) return { ok: false, error: { kind: 'timeout', message: 'Verification took too long.' } };
    const message = e instanceof Error ? e.message : 'Network error.';
    const kind = message.startsWith('Gemini') ? 'bad-response' : 'network';
    return { ok: false, error: { kind, message } };
  } finally {
    clearTimeout(timer);
  }
}

function simulatedResult(outcome: 'accept' | 'reject'): VerificationResult {
  return outcome === 'accept'
    ? {
        accepted: true,
        confidence: 1,
        feedback: 'Simulated check passed. In demo mode Thaw trusts you – no image analysis was performed.',
        observations: null,
        source: 'demo',
      }
    : {
        accepted: false,
        confidence: 0,
        feedback: 'Simulated rejection (you asked for one). Try another angle and resubmit.',
        observations: null,
        source: 'demo',
      };
}

async function verifyDemo(req: VerifyRequest, outcome: 'accept' | 'reject'): Promise<VerifyResponse> {
  await new Promise((r) => setTimeout(r, 1_400));
  if (!req.image.uri) return { ok: false, error: { kind: 'no-image', message: 'No photo selected.' } };
  return { ok: true, result: simulatedResult(outcome) };
}

export async function verifyEvidence(req: VerifyRequest, opts: VerifyOptions = {}): Promise<VerifyResponse> {
  if (!isLiveVerificationConfigured()) return verifyDemo(req, opts.demoOutcome ?? 'accept');
  const live = await verifyLive(req, opts.timeoutMs ?? 30_000);
  if (live.ok) return live;
  if (!req.image.uri) return live;
  return {
    ok: true,
    result: {
      ...simulatedResult('accept'),
      feedback: `Gemini could not check the photo (${live.error.message}). This check was simulated.`,
    },
  };
}
