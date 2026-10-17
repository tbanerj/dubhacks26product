import type { CollectibleTheme, LandmarkCategory, QuestMode, Rarity } from '../types';
import { colors } from './tokens';
import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Avatar colour from a hue – kept in a warm, earthy saturation band. */
export function hueColor(hue: number, light = 62): string {
  return `hsl(${Math.round(hue)}, 52%, ${light}%)`;
}

export const CATEGORY_STYLE: Record<LandmarkCategory, { icon: IconName; color: string; label: string }> = {
  park: { icon: 'pine-tree', color: colors.forest, label: 'Park' },
  garden: { icon: 'flower-tulip', color: colors.moss, label: 'Garden' },
  library: { icon: 'book-open-page-variant', color: colors.clay, label: 'Library' },
  market: { icon: 'storefront', color: colors.sunsetDeep, label: 'Market' },
  artwork: { icon: 'palette', color: colors.berry, label: 'Public art' },
  museum: { icon: 'bank', color: colors.clay, label: 'Museum' },
  historic: { icon: 'castle', color: colors.inkSoft, label: 'Historic' },
  viewpoint: { icon: 'binoculars', color: colors.sky, label: 'Viewpoint' },
  plaza: { icon: 'checkerboard', color: colors.sunsetDeep, label: 'Square' },
  fountain: { icon: 'fountain', color: colors.sky, label: 'Fountain' },
  shrine: { icon: 'gate', color: colors.berry, label: 'Shrine' },
  custom: { icon: 'map-marker-star', color: colors.forest, label: 'Chosen spot' },
};

export const MODE_STYLE: Record<QuestMode, { icon: IconName; label: string; bg: string; fg: string }> = {
  solo: { icon: 'walk', label: 'Solo', bg: colors.grassSoft, fg: colors.forestDeep },
  social: { icon: 'chat-outline', label: 'Social', bg: colors.butterSoft, fg: colors.ink },
  party: { icon: 'account-group', label: 'Party', bg: colors.sunsetSoft, fg: colors.sunsetDeep },
};

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; glow: string }> = {
  common: { label: 'Common', ring: colors.inkFaint, glow: colors.paperDeep },
  uncommon: { label: 'Uncommon', ring: colors.grass, glow: colors.grassSoft },
  rare: { label: 'Rare', ring: colors.sunset, glow: colors.sunsetSoft },
  legendary: { label: 'Legendary', ring: colors.butter, glow: colors.butterSoft },
};

export const THEME_STYLE: Record<CollectibleTheme, { label: string; base: string; accent: string }> = {
  botanical: { label: 'Botanical', base: colors.grassSoft, accent: colors.forest },
  architecture: { label: 'Architecture', base: colors.paperDeep, accent: colors.clay },
  culture: { label: 'Local culture', base: colors.sunsetSoft, accent: colors.sunsetDeep },
  hidden: { label: 'Hidden details', base: colors.skySoft, accent: colors.forestDeep },
  cooperative: { label: 'Co-op adventure', base: colors.butterSoft, accent: colors.sunsetDeep },
  neighborhood: { label: 'Neighbourhood', base: colors.paperDeep, accent: colors.forest },
};
