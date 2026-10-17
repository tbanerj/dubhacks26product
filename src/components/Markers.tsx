import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LandmarkCategory } from '../types';
import type { HubState } from '../game/questStatus';
import { CATEGORY_STYLE, type IconName } from '../theme/palette';
import { colors, fonts } from '../theme/tokens';
import { Critter } from './Critter';

const BADGE: Record<HubState, { icon: IconName; bg: string } | null> = {
  active: { icon: 'flag-checkered', bg: colors.sunset },
  new: { icon: 'star-four-points', bg: colors.butter },
  coop: { icon: 'account-group', bg: colors.sunsetSoft },
  collectible: { icon: 'pin-outline', bg: colors.grassSoft },
  available: null,
  completed: { icon: 'check-bold' as IconName, bg: colors.grass },
};

export const HUB_LABEL: Record<HubState, string> = {
  active: 'In progress',
  new: 'New quest',
  coop: 'Co-op quest',
  collectible: 'Pin to collect',
  available: 'Quest available',
  completed: 'Explored',
};

/**
 * Layered paper-pin marker for a quest hub. Plain Views (no SVG) so it renders
 * reliably inside native map markers on both platforms.
 */
export function HubMarker({ category, state, selected }: { category: LandmarkCategory; state: HubState; selected?: boolean }) {
  const cat = CATEGORY_STYLE[category];
  const done = state === 'completed';
  const badge = BADGE[state];
  const head = selected ? 52 : 44;
  return (
    <View style={styles.hubWrap}>
      {state === 'active' && <View style={[styles.halo, { width: head + 18, height: head + 18, borderRadius: (head + 18) / 2 }]} />}
      <View
        style={[
          styles.head,
          { width: head, height: head, borderRadius: head / 2, backgroundColor: done ? colors.paperDeep : cat.color },
          selected && { borderWidth: 3 },
        ]}
      >
        <View style={[styles.inner, { width: head - 12, height: head - 12, borderRadius: (head - 12) / 2, backgroundColor: done ? colors.paper : colors.paper }]}>
          <MaterialCommunityIcons name={cat.icon} size={selected ? 24 : 20} color={done ? colors.inkFaint : cat.color} />
        </View>
      </View>
      <View style={[styles.tail, { backgroundColor: done ? colors.paperDeep : cat.color }]} />
      {badge && (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <MaterialCommunityIcons name={badge.icon} size={12} color={colors.ink} />
        </View>
      )}
    </View>
  );
}

export function PlayerMarker({ hue, label }: { hue: number; label?: string }) {
  return (
    <View style={styles.playerWrap}>
      <View style={styles.playerGlow} />
      <Critter hue={hue} size={46} />
      {label ? (
        <View style={styles.playerTag}>
          <Text style={styles.playerTagText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hubWrap: { alignItems: 'center', justifyContent: 'flex-start', padding: 10 },
  halo: { position: 'absolute', top: 1, backgroundColor: colors.sunset, opacity: 0.3 },
  head: { borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  inner: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink },
  tail: {
    width: 14,
    height: 14,
    marginTop: -9,
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  playerWrap: { alignItems: 'center', padding: 6 },
  playerGlow: { position: 'absolute', top: 8, width: 50, height: 50, borderRadius: 25, backgroundColor: colors.butter, opacity: 0.45 },
  playerTag: {
    marginTop: -2,
    backgroundColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  playerTagText: { color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 10 },
});
