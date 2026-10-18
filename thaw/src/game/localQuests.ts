/**
 * Offline quest generator. Original templates written for Thaw, keyed on the
 * *kind* of place so quests fit what's actually there (a garden quest is about
 * plants, a library quest about reading rooms), never just "{name} + generic task".
 *
 * Output goes through the same `validateQuest` pipeline as Gemini output.
 */
import type { CollectibleTheme, Difficulty, Landmark, LandmarkCategory, LatLng, Quest, Rarity } from '../types';
import { distanceMeters } from './geo';
import { clampText } from '../utils/format';
import { stableHash, validateQuest, type RawQuest } from './questSchema';
import { BASE_XP } from './progression';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function timeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export const THEME_FOR_CATEGORY: Record<LandmarkCategory, CollectibleTheme> = {
  park: 'botanical',
  garden: 'botanical',
  library: 'culture',
  museum: 'culture',
  market: 'neighborhood',
  artwork: 'hidden',
  historic: 'architecture',
  viewpoint: 'neighborhood',
  plaza: 'architecture',
  fountain: 'hidden',
  shrine: 'culture',
  custom: 'neighborhood',
};

const THEME_NOUNS: Record<CollectibleTheme, string[]> = {
  botanical: ['Sprout', 'Leaf', 'Seedpod', 'Bloom'],
  architecture: ['Archway', 'Cornerstone', 'Column', 'Lintel'],
  culture: ['Bookmark', 'Lantern', 'Story Knot', 'Ticket'],
  hidden: ['Keyhole', 'Secret', 'Glint', 'Whisper'],
  cooperative: ['Circle', 'Compass', 'Kite', 'Chorus'],
  neighborhood: ['Doorway', 'Street Sign', 'Window', 'Bench'],
};

function shortName(name: string): string {
  // First two words, Unicode-safe; good enough for pin names in any script.
  const words = name.trim().split(/\s+/);
  return clampText(words.slice(0, 2).join(' '), 22);
}

function pick<T>(items: readonly T[], seed: string): T {
  const idx = parseInt(stableHash(seed), 36) % items.length;
  return items[idx] as T;
}

function rarityFor(difficulty: Difficulty, mode: RawQuest['mode']): Rarity {
  if (mode === 'party') return difficulty === 'hard' ? 'legendary' : 'rare';
  return difficulty === 'easy' ? 'common' : difficulty === 'medium' ? 'uncommon' : 'rare';
}

interface Ctx {
  lm: Landmark;
  tod: TimeOfDay;
}

type Template = (ctx: Ctx) => Omit<RawQuest, 'landmarkId' | 'collectible' | 'xp'> & { theme?: CollectibleTheme };

// ---------- Category-specific solo templates ----------

const SOLO: Partial<Record<LandmarkCategory, Template[]>> = {
  park: [
    ({ lm }) => ({
      title: 'Three Shades of Green',
      description: `${lm.name} is a palette. Find three plants that are three completely different greens.`,
      instructions: [
        `Wander the paths of ${lm.name}.`,
        'Find three leaves, mosses or grasses in clearly different greens.',
        'Arrange a photo where all three are visible without picking anything.',
      ],
      mode: 'solo', durationMin: 15, difficulty: 'easy',
      evidence: 'A photo showing three distinct greens growing in place.',
    }),
    ({ lm }) => ({
      title: 'Bench Philosopher',
      description: `Benches remember everyone who sat on them. Find the bench at ${lm.name} with the best view and borrow it for five minutes.`,
      instructions: [
        'Find a bench with a view you like.',
        'Sit for five quiet minutes and notice one sound you would normally miss.',
        'Photograph the view from the bench, not the bench itself.',
      ],
      mode: 'solo', durationMin: 10, difficulty: 'easy',
      evidence: 'A photo of the view from a public bench.',
    }),
  ],
  garden: [
    ({ lm }) => ({
      title: 'The Tiny Bloom Hunt',
      description: `Big flowers get all the attention at ${lm.name}. Go find the smallest one in bloom.`,
      instructions: [
        'Stay on the paths and look low.',
        'Find the smallest flower or bud you can spot.',
        'Take a close-up so it fills the frame. Leave it on the plant.',
      ],
      mode: 'solo', durationMin: 15, difficulty: 'easy',
      evidence: 'A close-up photo of a small flower or bud, unpicked.',
    }),
  ],
  library: [
    ({ lm }) => ({
      title: 'Spine Poetry',
      description: `Libraries hide poems on their shelves. Build one out of book titles at ${lm.name}.`,
      instructions: [
        'Browse any public shelf quietly.',
        'Pick 3–4 books whose titles read like a short poem when stacked.',
        'Photograph the stack, then reshelve them or leave them on a return cart.',
      ],
      mode: 'solo', durationMin: 20, difficulty: 'medium',
      evidence: 'A photo of a stack of book spines forming a phrase.',
    }),
  ],
  museum: [
    ({ lm }) => ({
      title: 'The Overlooked Exhibit',
      description: `Every museum has a piece nobody stops for. Find the quiet star of ${lm.name}'s public spaces.`,
      instructions: [
        'Explore any free or public area of the building or its grounds.',
        'Find an object or detail that nobody seems to be looking at.',
        'Photograph it if photography is allowed; otherwise photograph the building entrance.',
      ],
      mode: 'solo', durationMin: 25, difficulty: 'medium',
      evidence: 'A photo of an overlooked detail, or the entrance where photos are not allowed.',
    }),
  ],
  market: [
    ({ lm }) => ({
      title: 'Colour Census',
      description: `${lm.name} is loud with colour. Find the single most vivid thing on display.`,
      instructions: [
        'Walk the public aisles without needing to stop at stalls.',
        'Find the most saturated colour you can: produce, signs, awnings, anything.',
        'Take a photo of it, asking the stall holder first if it is their goods.',
      ],
      mode: 'solo', durationMin: 15, difficulty: 'easy',
      evidence: 'A photo of one vividly coloured item or sign.',
    }),
  ],
  artwork: [
    ({ lm }) => ({
      title: 'Artist’s Signature',
      description: `Public art often hides a signature, plaque or date. Find the maker’s mark on ${lm.name}.`,
      instructions: [
        'Circle the artwork at a respectful distance.',
        'Look for a plaque, signature, date or maker’s mark.',
        'If there is none, photograph the part of the work you think the artist was proudest of.',
      ],
      mode: 'solo', durationMin: 10, difficulty: 'easy',
      evidence: 'A photo of a plaque, signature, or favourite detail.',
    }),
  ],
  historic: [
    ({ lm }) => ({
      title: 'Read the Stones',
      description: `Old places carry marks of time. Find one sign of age at ${lm.name}: a worn step, a repaired wall, a faded date.`,
      instructions: [
        'Explore the publicly accessible parts of the site.',
        'Look for wear, repairs, carvings or dates that show the passing of time.',
        'Photograph the detail up close.',
      ],
      mode: 'solo', durationMin: 15, difficulty: 'medium',
      evidence: 'A close-up photo of a weathered or repaired detail.',
    }),
  ],
  viewpoint: [
    ({ lm }) => ({
      title: 'Frame the Neighbourhood',
      description: `From ${lm.name}, the city becomes a map. Find one landmark in the distance and frame it.`,
      instructions: [
        'Stand at the public viewing area, away from any edges.',
        'Pick one distant building, tree or hill you can recognise.',
        'Frame it using something nearby: a railing gap, a branch, your hands.',
      ],
      mode: 'solo', durationMin: 10, difficulty: 'easy',
      evidence: 'A photo of a distant landmark framed by something close.',
    }),
  ],
  plaza: [
    ({ lm }) => ({
      title: 'Pattern Underfoot',
      description: `Look down at ${lm.name}. Paving, tiles and drains form patterns most people walk right over.`,
      instructions: [
        'Find a repeating pattern in the ground: tiles, bricks, grates or cracks.',
        'Stand out of the way of foot traffic.',
        'Photograph the pattern from directly above.',
      ],
      mode: 'solo', durationMin: 10, difficulty: 'easy',
      evidence: 'A top-down photo of a ground pattern.',
    }),
  ],
  fountain: [
    ({ lm }) => ({
      title: 'Catch the Splash',
      description: `Water never repeats itself. Capture one unique moment at ${lm.name}.`,
      instructions: [
        'Watch the water for a minute and find its rhythm.',
        'Take a burst or several photos to freeze a splash, ripple or reflection.',
        'Keep your phone dry and stay out of the water.',
      ],
      mode: 'solo', durationMin: 10, difficulty: 'easy',
      evidence: 'A photo of moving water, a ripple or a reflection.',
    }),
  ],
  shrine: [
    ({ lm }) => ({
      title: 'Quiet Observer',
      description: `${lm.name} is a place others may visit for reflection. Visit respectfully and notice the craft in its gates, roofs or gardens.`,
      instructions: [
        'Follow any posted visitor guidance and keep your voice low.',
        'Observe the craftsmanship: carving, joinery, stone or planting.',
        'Photograph an architectural or garden detail only where photos are permitted. Never photograph people praying.',
      ],
      mode: 'solo', durationMin: 15, difficulty: 'easy',
      evidence: 'A photo of an architectural or garden detail (no people).',
    }),
  ],
  custom: [
    ({ lm }) => ({
      title: 'Know This Corner',
      description: `You picked ${lm.name}. Prove you know it better than anyone by finding its smallest interesting detail.`,
      instructions: [
        'Look around within a short walk of your chosen spot.',
        'Find something tiny and interesting: a sticker, sign, plant or mark.',
        'Take a close-up photo of it.',
      ],
      mode: 'solo', durationMin: 10, difficulty: 'easy',
      evidence: 'A close-up of a small, interesting detail nearby.',
    }),
  ],
};

// ---------- Social templates (always with a solo alternative) ----------

const SOCIAL: Template[] = [
  ({ lm }) => ({
    title: 'Two Different Worlds',
    description: `Swap one local recommendation with a fellow explorer at ${lm.name}: a place you'd send a visitor.`,
    instructions: [
      'If someone nearby is a Thaw player or your party is with you, say hi.',
      'Each of you shares one place you would recommend to a visitor, and why.',
      'Photograph something at the landmark that reminds you of your recommendation.',
    ],
    soloAlternative: 'Write your own recommendation in your head, then photograph something here that captures its feeling.',
    mode: 'social', durationMin: 15, difficulty: 'medium',
    evidence: 'A photo of something at the landmark that matches a recommendation.',
    safetyNotes: ['Only chat with people who are clearly happy to; a friendly "no thanks" ends it.', 'Never share contact details.'],
  }),
  ({ lm }) => ({
    title: 'What Do You See?',
    description: `Two people can stare at ${lm.name} and see different things. Compare notes with someone, or with your past self.`,
    instructions: [
      'With a party member or a willing fellow player, each pick one detail without telling the other.',
      'Describe your detail in three words; the other person tries to find it.',
      'Photograph the detail that was hardest to find.',
    ],
    soloAlternative: 'Pick a detail, describe it in three words, walk away for a minute, then see if you can find it again.',
    mode: 'social', durationMin: 15, difficulty: 'easy',
    evidence: 'A photo of the detail that was hardest to spot.',
    safetyNotes: ['Keep it to people who opted in. No photos of anyone without their consent.'],
  }),
];

// ---------- Party templates (2–4 players) ----------

const PARTY: Template[] = [
  ({ lm }) => ({
    title: 'The Human Compass',
    description: `Form a crew of 2–4. Everyone picks a detail at ${lm.name}, then you build one photo that includes them all.`,
    instructions: [
      'Meet at a visible, public spot near the landmark.',
      'Each person picks one detail: a texture, a sign, a shape, a colour.',
      'Compose one group photo where every chosen detail appears. Faces are optional; hands or shadows work too.',
    ],
    soloAlternative: 'Pick four details yourself and compose a single photo that includes them all.',
    mode: 'party', minParty: 2, maxParty: 4, durationMin: 25, difficulty: 'hard',
    evidence: 'One composed photo containing every party member’s chosen detail.',
    safetyNotes: ['Meet in the open, near the main entrance or path.', 'Anyone can leave the party at any time.'],
  }),
  ({ lm }) => ({
    title: 'Shadow Constellation',
    description: `Use your shadows to draw a shape on the ground at ${lm.name} – a star, a letter, a creature.`,
    instructions: [
      'Find an open, sunny patch away from foot traffic.',
      'Agree on a shape and arrange your shadows to form it.',
      'One person photographs the shadows from a safe, stable spot.',
    ],
    soloAlternative: 'Use your own shadow plus objects like a bag or hat to make a shape.',
    mode: 'party', minParty: 2, maxParty: 4, durationMin: 20, difficulty: 'medium',
    evidence: 'A photo of shadows forming a recognisable shape (no faces needed).',
    safetyNotes: ['Daylight quest – skip it after sunset.'],
  }),
];

const GENERIC_SOLO: Template[] = [
  ({ lm }) => ({
    title: 'The Local Lens',
    description: `Most people walk past ${lm.name} without looking. Find the detail they miss.`,
    instructions: [
      `Spend a few minutes around ${lm.name}.`,
      'Find a small detail most people would overlook: a texture, sign or shape.',
      'Take a creative photo of it from an unusual angle.',
    ],
    mode: 'solo', durationMin: 10, difficulty: 'easy',
    evidence: 'A creative photo of an overlooked detail.',
  }),
];

export interface GenerateOptions {
  now?: Date;
  /** Max quests per landmark. */
  perLandmark?: number;
}

/**
 * Deterministic: the same landmark at the same time-of-day always yields the same
 * quests (and the same quest IDs), so completions stay idempotent across restarts.
 */
export function generateLocalQuests(landmarks: Landmark[], opts: GenerateOptions = {}): Quest[] {
  const tod = timeOfDay(opts.now);
  const perLandmark = opts.perLandmark ?? 2;
  const byId = new Map(landmarks.map((l) => [l.id, l]));
  const out: Quest[] = [];

  for (const lm of landmarks) {
    const ctx: Ctx = { lm, tod };
    const soloPool = SOLO[lm.category] ?? GENERIC_SOLO;
    const chosen: Template[] = [pick(soloPool, `${lm.id}:solo`)];
    if (perLandmark > 1) {
      // At night, skip shadow/party quests that need daylight; offer a social one instead.
      const useParty = tod !== 'night' && parseInt(stableHash(`${lm.id}:mode`), 36) % 2 === 0;
      chosen.push(pick(useParty ? PARTY : SOCIAL, `${lm.id}:social`));
    }

    for (const tpl of chosen) {
      const t = tpl(ctx);
      const theme: CollectibleTheme = t.mode === 'party' ? 'cooperative' : (t.theme ?? THEME_FOR_CATEGORY[lm.category]);
      const raw: RawQuest = {
        landmarkId: lm.id,
        title: t.title,
        description: clampText(t.description, 240),
        instructions: t.instructions,
        soloAlternative: t.soloAlternative ?? null,
        mode: t.mode,
        minParty: t.minParty,
        maxParty: t.maxParty,
        durationMin: t.durationMin,
        difficulty: t.difficulty,
        xp: BASE_XP[t.difficulty],
        collectible: {
          theme,
          rarity: rarityFor(t.difficulty, t.mode),
          name: clampText(`${shortName(lm.name)} ${pick(THEME_NOUNS[theme], lm.id)}`, 40),
        },
        evidence: t.evidence,
        safetyNotes: [
          ...(t.safetyNotes ?? []),
          ...(tod === 'night' ? ['It’s late – save this one for daylight if the area is quiet.'] : []),
        ],
      };
      const result = validateQuest(raw, byId, 'local');
      if (result.ok) out.push(result.quest);
    }
  }
  return out;
}

const DEMO_QUESTS: Array<{ title: string; description: string; instructions: string[]; evidence: string; theme: CollectibleTheme; pin: string }> = [
  {
    title: 'Find a Book (demo)',
    description: 'Look for a book, magazine, or printed page you can see without leaving this public area.',
    instructions: ['Stay in the public area of this place.', 'Find a book, magazine, or printed page.', 'Photograph the cover or a page. Leave it where it is.'],
    evidence: 'A photo of a book, magazine, or printed page.',
    theme: 'culture',
    pin: 'Demo Bookmark',
  },
  {
    title: 'Read a Sign (demo)',
    description: 'Find a public sign or plaque and photograph the words you can read from the path.',
    instructions: ['Look for a sign, plaque, or posted notice.', 'Read it from the public path.', 'Photograph the words without blocking anyone.'],
    evidence: 'A photo of a public sign or plaque.',
    theme: 'neighborhood',
    pin: 'Demo Notice',
  },
  {
    title: 'Spot a Seat (demo)',
    description: 'Find a bench, ledge, or chair that is already there and photograph it. Do not move it.',
    instructions: ['Find a bench, ledge, or chair in the public area.', 'Leave it exactly where it is.', 'Photograph the seat from the path.'],
    evidence: 'A photo of a bench, ledge, or chair.',
    theme: 'architecture',
    pin: 'Demo Seat',
  },
];

/** Three short solo quests for a walkthrough. Titles end with " (demo)". */
export function demoQuestsForLandmark(landmark: Landmark): Quest[] {
  const byId = new Map([[landmark.id, landmark]]);
  const out: Quest[] = [];
  for (const demo of DEMO_QUESTS) {
    const result = validateQuest(
      {
        landmarkId: landmark.id,
        title: demo.title,
        description: demo.description,
        instructions: demo.instructions,
        mode: 'solo',
        durationMin: 5,
        difficulty: 'easy',
        xp: BASE_XP.easy,
        collectible: { theme: demo.theme, rarity: 'common', name: demo.pin },
        evidence: demo.evidence,
        safetyNotes: ['Stay on the public path. Do not touch or move anything.'],
      },
      byId,
      'local',
    );
    if (result.ok) out.push(result.quest);
  }
  return out;
}

/** Keep the live quest list, and add the demo set on the landmark closest to the player. */
export function withDemoQuests(landmarks: Landmark[], quests: Quest[], center: LatLng): Quest[] {
  const first = landmarks[0];
  if (!first) return quests;
  let nearest: Landmark = first;
  let best = distanceMeters(center, nearest.coordinate);
  for (const lm of landmarks) {
    const d = distanceMeters(center, lm.coordinate);
    if (d < best) {
      best = d;
      nearest = lm;
    }
  }
  const have = new Set(quests.map((q) => q.id));
  return [...quests, ...demoQuestsForLandmark(nearest).filter((q) => !have.has(q.id))];
}
