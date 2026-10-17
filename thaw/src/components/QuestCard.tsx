import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { QuestEntry } from '../hooks/useWorld';
import { CATEGORY_STYLE, MODE_STYLE } from '../theme/palette';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { formatDistance, type UnitSystem } from '../utils/format';
import { Chip } from './Paper';
import { PinArt } from './PinArt';

const STATUS_CHIP = {
  new: { label: 'New', bg: colors.butter },
  active: { label: 'In progress', bg: colors.sunset },
  completed: { label: 'Done', bg: colors.grass },
  available: null,
} as const;

/** Compact quest card used in lists and the map's bottom tray. */
export function QuestCard({ entry, units, onPress, width }: { entry: QuestEntry; units: UnitSystem; onPress: () => void; width?: number }) {
  const { quest, landmark, status, distanceM } = entry;
  const cat = CATEGORY_STYLE[landmark.category];
  const mode = MODE_STYLE[quest.mode];
  const chip = STATUS_CHIP[status];
  const done = status === 'completed';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${quest.title} at ${landmark.name}. ${mode.label} quest, ${quest.xp} XP, ${formatDistance(distanceM, units)} away.${chip ? ` ${chip.label}.` : ''}`}
      style={({ pressed }) => [styles.card, width ? { width } : null, done && styles.done, pressed && { transform: [{ translateY: 2 }] }]}
    >
      <View style={styles.top}>
        <View style={[styles.catDot, { backgroundColor: cat.color }]}>
          <MaterialCommunityIcons name={cat.icon} size={16} color={colors.paper} />
        </View>
        <Text style={[type.small, styles.place]} numberOfLines={1}>
          {landmark.name}
        </Text>
        {chip && <Chip label={chip.label} bg={chip.bg} />}
      </View>
      <View style={styles.middle}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.subheading} numberOfLines={2}>
            {quest.title}
          </Text>
          <Text style={type.small} numberOfLines={2}>
            {quest.description}
          </Text>
        </View>
        <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={46} />
      </View>
      <View style={styles.meta}>
        <Chip label={mode.label} icon={mode.icon} bg={mode.bg} fg={mode.fg} />
        <Chip label={`${quest.xp} XP`} icon="lightning-bolt-outline" bg={colors.butterSoft} />
        <Chip label={formatDistance(distanceM, units)} icon="map-marker-path" bg={colors.paper} />
        {quest.source === 'gemini' && <Chip label="AI" icon="star-four-points" bg={colors.skySoft} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    padding: spacing.md,
    gap: spacing.sm,
  },
  done: { backgroundColor: colors.paperDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  place: { flex: 1, fontFamily: fonts.bodyBold },
  middle: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
