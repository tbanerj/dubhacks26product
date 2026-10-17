export interface LatLng {
  latitude: number;
  longitude: number;
}

export type LandmarkCategory =
  | 'park'
  | 'garden'
  | 'library'
  | 'market'
  | 'artwork'
  | 'museum'
  | 'historic'
  | 'viewpoint'
  | 'plaza'
  | 'fountain'
  | 'shrine'
  | 'custom';

export type PlaceSource = 'openstreetmap' | 'seed' | 'player';

export interface Landmark {
  id: string;
  name: string;
  category: LandmarkCategory;
  coordinate: LatLng;
  source: PlaceSource;
  /** Optional short local context, e.g. "Public park" — never invented facts. */
  blurb?: string;
}

export type QuestMode = 'solo' | 'social' | 'party';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type CollectibleTheme =
  | 'botanical'
  | 'architecture'
  | 'culture'
  | 'hidden'
  | 'cooperative'
  | 'neighborhood';

export type QuestSource = 'gemini' | 'local';

export interface Quest {
  id: string;
  landmarkId: string;
  title: string;
  description: string;
  instructions: string[];
  /** Solo alternative so nobody is forced into social contact. */
  soloAlternative: string | null;
  mode: QuestMode;
  minParty: number;
  maxParty: number;
  durationMin: number;
  difficulty: Difficulty;
  xp: number;
  collectible: { theme: CollectibleTheme; rarity: Rarity; name: string };
  evidence: string;
  safetyNotes: string[];
  source: QuestSource;
}

export type QuestStatus = 'available' | 'new' | 'active' | 'completed';

export interface CompletionRecord {
  questId: string;
  landmarkId: string;
  landmarkName: string;
  questTitle: string;
  xp: number;
  completedAt: string; // ISO
  dayKey: string; // local YYYY-MM-DD at completion time
  collectibleId: string | null;
  partySize: number;
}

export interface OwnedCollectible {
  id: string;
  name: string;
  theme: CollectibleTheme;
  rarity: Rarity;
  landmarkName: string;
  unlockedAt: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  avatarHue: number; // 0..360 – avatar body color
  homeRegionId: string | null;
}

export interface Progress {
  totalXp: number;
  xpByDay: Record<string, number>;
  streak: number;
  lastActiveDay: string | null;
  completions: CompletionRecord[];
  visitedLandmarkIds: string[];
  collectibles: OwnedCollectible[];
}

export interface RewardSummary {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  collectible: OwnedCollectible | null;
  newLandmark: boolean;
  streak: number;
}

export type VerificationSource = 'gemini' | 'demo';

export interface VerificationResult {
  accepted: boolean;
  confidence: number; // 0..1
  feedback: string;
  observations: string | null;
  source: VerificationSource;
}

export interface DemoRegion {
  id: string;
  name: string;
  country: string;
  emoji: string;
  center: LatLng;
  /** IETF tag used as a cultural/locale hint for quest generation. */
  localeHint: string;
}

export type LocationMode = 'gps' | 'region' | 'manual';

export interface PartyMember {
  id: string;
  name: string;
  avatarHue: number;
  ready: boolean;
  isSelf: boolean;
  isDemo: boolean;
  isHost?: boolean;
  level: number;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  system?: boolean;
}

export interface NearbyPlayer {
  id: string;
  name: string;
  avatarHue: number;
  level: number;
  /** Coarse, privacy-preserving proximity bucket – never an exact position. */
  proximity: 'very-near' | 'near' | 'around';
  lookingFor: string;
  isDemo: boolean;
}

export interface Party {
  id: string;
  name: string;
  members: PartyMember[];
  questId: string | null;
  questTitle?: string | null;
  capacity: number;
  /** Real parties only. */
  code?: string;
  isHost?: boolean;
  expiresAt?: string;
}

export type ConnectionState = 'offline' | 'connecting' | 'simulated' | 'connected' | 'reconnecting';
