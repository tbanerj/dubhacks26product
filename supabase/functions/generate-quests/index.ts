// AI quest writing with Google Gemini, server-side so the API key never ships in the app.
// The app still validates + safety-filters every quest it receives (src/game/questSchema.ts)
// and falls back to its built-in templates if this function is unavailable.
//
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function key(envJson: string, legacy: string): string {
  try {
    const parsed = JSON.parse(Deno.env.get(envJson) ?? '{}') as Record<string, string>;
    if (parsed.default) return parsed.default;
  } catch {
    // fall through
  }
  return Deno.env.get(legacy) ?? '';
}

const HOURLY_LIMIT = 30;
const CATEGORIES = ['park', 'garden', 'library', 'market', 'artwork', 'museum', 'historic', 'viewpoint', 'plaza', 'fountain', 'shrine', 'custom'];
const TIMES = ['morning', 'afternoon', 'evening', 'night'];

type Place = { landmarkId: string; name: string; category: string; distanceMeters: number };
type Ctx = { localeHint: string; regionName: string | null; timeOfDay: string; partySize: number; preferSolo: boolean; mobilityFriendly: boolean };

function clean(s: unknown, max: number): string {
  return String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function validate(b: unknown): { places: Place[]; ctx: Ctx } | null {
  const x = b as { landmarks?: unknown; context?: Partial<Ctx> };
  if (!x || !Array.isArray(x.landmarks) || x.landmarks.length === 0) return null;
  const places: Place[] = [];
  for (const raw of x.landmarks.slice(0, 10)) {
    const p = raw as Partial<Place>;
    if (typeof p.landmarkId !== 'string' || p.landmarkId.length > 120 || !CATEGORIES.includes(String(p.category))) continue;
    places.push({ landmarkId: p.landmarkId, name: clean(p.name, 60), category: String(p.category), distanceMeters: Math.max(0, Math.min(50_000, Number(p.distanceMeters) || 0)) });
  }
  if (places.length === 0) return null;
  const c = x.context ?? {};
  return {
    places,
    ctx: {
      localeHint: clean(c.localeHint, 20) || 'en',
      regionName: c.regionName ? clean(c.regionName, 60) : null,
      timeOfDay: TIMES.includes(String(c.timeOfDay)) ? String(c.timeOfDay) : 'afternoon',
      partySize: Math.max(1, Math.min(4, Number(c.partySize) || 1)),
      preferSolo: c.preferSolo === true,
      mobilityFriendly: c.mobilityFriendly === true,
    },
  };
}

const SCHEMA = {
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
};

function prompt(places: Place[], c: Ctx): string {
  return [
    'You design quests for Thaw, a real-world social exploration game that helps people feel less lonely in their city.',
    `Context: region=${c.regionName ?? 'player location'}, locale=${c.localeHint}, local time of day=${c.timeOfDay}, current party size=${c.partySize}.`,
    c.preferSolo ? 'The player prefers solo quests: make every quest mode "solo".' : 'Mix solo, social and party (2-4 players) quests.',
    c.mobilityFriendly ? 'The player prefers low-mobility quests: little walking, no stairs, under 20 minutes.' : '',
    'Write 1-2 quests per place below. Each quest must be specific to what that KIND of place offers (category + name), not a generic template.',
    'Hard rules:',
    '- Public, accessible areas only. No trespassing, restricted areas, roofs, edges, water entry, or isolated spots.',
    '- Never require spending money, sharing contact details or personal info, or photographing strangers. Faces are never required.',
    '- Social/party quests must be optional for strangers ("if someone is happy to") and MUST include a soloAlternative.',
    '- Do not state facts about the place you are not certain of. No cultural, religious or political assumptions or stereotypes.',
    c.timeOfDay === 'night' ? '- It is night: prefer short quests in well-lit public spots, and suggest daylight for anything else.' : '',
    '- Evidence must be a photo of an object, detail, composition, or consenting group arrangement, checkable from a single photo.',
    '- title <= 60 chars, description <= 200 chars, 1-4 instructions <= 180 chars each, collectible.name <= 40 chars.',
    '- Use cooperative theme for party quests. XP: easy~60, medium~90, hard~130.',
    'Write in English but respect local names.',
    `Places: ${JSON.stringify(places)}`,
  ].filter(Boolean).join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'not_authenticated' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !auth.user) return json(401, { error: 'not_authenticated' });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json(503, { error: 'generator_unavailable' });

  let input: ReturnType<typeof validate> = null;
  try {
    input = validate(await req.json());
  } catch {
    input = null;
  }
  if (!input) return json(400, { error: 'invalid_input' });

  const admin = createClient(url, key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id).eq('kind', 'quests').gte('created_at', since);
  if ((count ?? 0) >= HOURLY_LIMIT) return json(429, { error: 'rate_limited' });
  await admin.from('ai_usage').insert({ user_id: auth.user.id, kind: 'quests' });

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt(input.places, input.ctx) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.9, maxOutputTokens: 4096 },
      }),
    });
    if (!res.ok) return json(502, { error: `gemini_http_${res.status}` });
    const data = await res.json();
    if (data?.promptFeedback?.blockReason) return json(502, { error: 'gemini_blocked' });
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const parsed = JSON.parse(text) as { quests?: unknown[] };
    return json(200, { quests: Array.isArray(parsed.quests) ? parsed.quests.slice(0, 20) : [] });
  } catch {
    return json(502, { error: 'gemini_failed' });
  }
});
