/**
 * Quest generation via Google Gemini (generateContent REST API, JSON mode), with a
 * deterministic local generator as fallback. The return shape is identical either way.
 *
 * Config: EXPO_PUBLIC_GEMINI_API_KEY (placeholder GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE).
 * Production note: a key bundled into the app is extractable; route this through a
 * backend proxy before shipping publicly.
 */
import type { Landmark, LatLng, Quest } from '../types';
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
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
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
        maxOutputTokens: 4096,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = (await res.json()) as GeminiResponse;
  if (json.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${json.promptFeedback.blockReason}`);
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text) as unknown;
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
