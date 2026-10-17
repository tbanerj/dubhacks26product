/**
 * Runtime validation for quests from *any* source. AI output is untrusted: it is
 * parsed with zod, screened by the safety filter, then normalised into a `Quest`.
 */
import { z } from 'zod';
import type { Landmark, Quest } from '../types';
import { normaliseQuestXp } from './progression';

export const RawQuestSchema = z.object({
  landmarkId: z.string().min(1).max(120),
  title: z.string().min(3).max(60),
  description: z.string().min(10).max(240),
  instructions: z.array(z.string().min(3).max(200)).min(1).max(5),
  soloAlternative: z.string().min(3).max(200).nullable().optional(),
  mode: z.enum(['solo', 'social', 'party']),
  minParty: z.number().int().min(1).max(4).optional(),
  maxParty: z.number().int().min(1).max(4).optional(),
  durationMin: z.number().int().min(3).max(90),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  xp: z.number().int().min(10).max(500).optional(),
  collectible: z.object({
    theme: z.enum(['botanical', 'architecture', 'culture', 'hidden', 'cooperative', 'neighborhood']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),
    name: z.string().min(3).max(40),
  }),
  evidence: z.string().min(5).max(200),
  safetyNotes: z.array(z.string().max(160)).max(4).optional(),
});

export type RawQuest = z.infer<typeof RawQuestSchema>;

export const RawQuestListSchema = z.object({ quests: z.array(z.unknown()).max(20) });

/**
 * Phrases we never allow in a quest, regardless of source. Deliberately broad –
 * a false positive just means we fall back to a local quest.
 */
const UNSAFE_PATTERNS: RegExp[] = [
  /\btrespass/i,
  /\brestricted\b/i,
  /\b(climb|scale)\b.*\b(fence|wall|roof|gate)/i,
  /\broof(top)?\b/i,
  /\bafter dark\b|\bat night\b|\bmidnight\b/i,
  /\bphone number|\bemail address|\bhome address|\bwhere (they|you) live|\binstagram|\bsocial media handle|\bcontact info/i,
  /\b(buy|purchase|pay for|spend money|spend some money)\b/i,
  /\bwhile driving\b|\bdrive\b/i,
  /\bphotograph (a )?strangers?\b|\bphoto of (a )?strangers?\b|\bselfie with (a )?stranger/i,
  /\bfollow (someone|them|a stranger)/i,
  /\b(alcohol|drink(ing)? (beer|wine)|bar crawl)\b/i,
  /\b(alley|abandoned|isolated|secluded)\b/i,
  /\binterrupt\b.*\b(worker|staff|employee)/i,
  /\bpolitic|\breligio(n|us) (belief|view)/i,
  /\bjaywalk|\bcross against\b/i,
];

export function findUnsafeContent(texts: string[]): string | null {
  for (const t of texts) {
    for (const p of UNSAFE_PATTERNS) if (p.test(t)) return t;
  }
  return null;
}

export type QuestValidation = { ok: true; quest: Quest } | { ok: false; reason: string };

/** FNV-1a hash → stable base36 id. Deterministic ids keep completions idempotent across regenerations. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function questId(landmarkId: string, source: string, title: string): string {
  return `q-${source}-${landmarkId}-${stableHash(title.trim().toLowerCase())}`;
}

/**
 * Validate an untrusted quest object against the schema, the safety filter, and the
 * set of landmarks it claims to belong to.
 */
export function validateQuest(
  raw: unknown,
  landmarks: ReadonlyMap<string, Landmark>,
  source: Quest['source'],
): QuestValidation {
  const parsed = RawQuestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: `schema: ${parsed.error.issues[0]?.message ?? 'invalid'}` };
  const q = parsed.data;

  const landmark = landmarks.get(q.landmarkId);
  if (!landmark) return { ok: false, reason: `unknown landmark ${q.landmarkId}` };

  const unsafe = findUnsafeContent([
    q.title,
    q.description,
    q.evidence,
    ...q.instructions,
    q.soloAlternative ?? '',
  ]);
  if (unsafe) return { ok: false, reason: `unsafe content: "${unsafe.slice(0, 60)}"` };

  // Social/party quests must always offer a solo path – nobody is required to approach strangers.
  if (q.mode !== 'solo' && !q.soloAlternative) return { ok: false, reason: 'social quest without solo alternative' };

  const minParty = q.mode === 'party' ? Math.max(2, q.minParty ?? 2) : 1;
  const maxParty = q.mode === 'party' ? Math.max(minParty, Math.min(4, q.maxParty ?? 4)) : q.mode === 'social' ? 4 : 1;

  const quest: Quest = {
    id: questId(landmark.id, source, q.title),
    landmarkId: landmark.id,
    title: q.title.trim(),
    description: q.description.trim(),
    instructions: q.instructions.map((s) => s.trim()),
    soloAlternative: q.soloAlternative?.trim() || null,
    mode: q.mode,
    minParty,
    maxParty,
    durationMin: q.durationMin,
    difficulty: q.difficulty,
    xp: normaliseQuestXp(q.difficulty, q.xp),
    collectible: q.collectible,
    evidence: q.evidence.trim(),
    safetyNotes: [
      ...new Set([
        ...(q.safetyNotes ?? []).filter((n) => !findUnsafeContent([n])),
        'Stay in public, well-lit areas.',
      ]),
    ].slice(0, 4),
    source,
  };
  return { ok: true, quest };
}
