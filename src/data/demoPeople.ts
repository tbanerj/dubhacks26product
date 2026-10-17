/**
 * Fictional demo participants. They are always flagged `isDemo` and labelled as
 * such in the UI – Thaw never presents them as real nearby people.
 */
import type { NearbyPlayer, PlayerProfile } from '../types';
import { stableHash } from '../game/questSchema';

export const DEMO_PLAYER_PROFILE: PlayerProfile = {
  id: 'me',
  name: 'Wren',
  avatarHue: 28,
  homeRegionId: null,
};

export const DEMO_NEARBY: NearbyPlayer[] = [
  { id: 'demo-mika', name: 'Mika', avatarHue: 150, level: 4, proximity: 'very-near', lookingFor: 'Party quests', isDemo: true },
  { id: 'demo-ade', name: 'Adé', avatarHue: 45, level: 3, proximity: 'near', lookingFor: 'Photo walks', isDemo: true },
  { id: 'demo-lucia', name: 'Lucía', avatarHue: 330, level: 6, proximity: 'near', lookingFor: 'Hidden details', isDemo: true },
  { id: 'demo-wanjiru', name: 'Wanjiru', avatarHue: 95, level: 2, proximity: 'around', lookingFor: 'Gardens & parks', isDemo: true },
  { id: 'demo-tomas', name: 'Tomás', avatarHue: 200, level: 5, proximity: 'around', lookingFor: 'Anything social', isDemo: true },
];

/** Scripted, friendly replies for the local chat simulation. */
export const DEMO_CHAT_LINES: string[] = [
  'Hi! Happy to team up 👋',
  'I’m near the main entrance, wearing a yellow scarf.',
  'Ready whenever you are.',
  'Ooh, I found a great detail already.',
  'Shall we meet by the big tree?',
  'Love this spot.',
];

export interface DemoRival {
  id: string;
  name: string;
  avatarHue: number;
  totalXp: number;
  quests: number;
  landmarks: number;
}

export const DEMO_RIVALS: DemoRival[] = [
  { id: 'demo-lucia', name: 'Lucía', avatarHue: 330, totalXp: 1640, quests: 19, landmarks: 14 },
  { id: 'demo-tomas', name: 'Tomás', avatarHue: 200, totalXp: 1180, quests: 14, landmarks: 11 },
  { id: 'demo-mika', name: 'Mika', avatarHue: 150, totalXp: 720, quests: 9, landmarks: 8 },
  { id: 'demo-ade', name: 'Adé', avatarHue: 45, totalXp: 410, quests: 6, landmarks: 5 },
  { id: 'demo-wanjiru', name: 'Wanjiru', avatarHue: 95, totalXp: 220, quests: 3, landmarks: 3 },
  { id: 'demo-sora', name: 'Sora', avatarHue: 260, totalXp: 95, quests: 1, landmarks: 1 },
];

/** Deterministic per-day XP for rivals so the daily board changes day to day. */
export function rivalDailyXp(rivalId: string, dayKey: string): number {
  const n = parseInt(stableHash(`${rivalId}:${dayKey}`), 36);
  return [0, 0, 60, 90, 110, 150, 200][n % 7] ?? 0;
}
