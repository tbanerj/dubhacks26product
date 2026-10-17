import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuestEntry } from '../hooks/useWorld';
import { MODE_STYLE } from '../theme/palette';
import { useTheme } from '../theme/useTheme';
import { formatDistance, type UnitSystem } from '../utils/format';
import { walkingMinutes } from '../game/geo';
import { MetaRow } from './Paper';
import { PinArt } from './PinArt';
import { Button } from './Button';

const STATUS_LABEL = {
  new: 'New',
  active: 'In progress',
  completed: 'Done',
  available: null,
} as const;

/** Compact quest row for lists. */
export function QuestCard({ entry, units, onPress, selected }: { entry: QuestEntry; units: UnitSystem; onPress: () => void; width?: number; selected?: boolean }) {
  const { quest, landmark, status, distanceM } = entry;
  const { colors, radii, type } = useTheme();
  const mode = MODE_STYLE[quest.mode];
  const statusLabel = STATUS_LABEL[status];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${quest.title} at ${landmark.name}. ${mode.label} quest, ${quest.xp} XP, ${formatDistance(distanceM, units)} away.${statusLabel ? ` ${statusLabel}.` : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? colors.sageSoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radii.lg,
          opacity: pressed ? 0.85 : status === 'completed' ? 0.7 : 1,
        },
      ]}
    >
      <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {quest.title}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {landmark.name}
          {statusLabel ? ` · ${statusLabel}` : ''}
          {quest.source === 'local' ? ' · Built-in' : ''}
        </Text>
        <MetaRow
          items={[
            { icon: 'walk', label: `${walkingMinutes(distanceM)} min` },
            { icon: 'timer-outline', label: `${quest.durationMin} min` },
            { icon: 'star-four-points-outline', label: `${quest.xp} XP` },
          ]}
        />
      </View>
    </Pressable>
  );
}

/** Collapsed map preview: title, place, walk, duration, reward, and the quest action. */
export function QuestPreview({
  entry,
  units,
  actionLabel,
  onPress,
}: {
  entry: QuestEntry;
  units: UnitSystem;
  actionLabel: string;
  onPress: () => void;
}) {
  const { quest, landmark, distanceM } = entry;
  const { type, colors } = useTheme();
  return (
    <View style={styles.preview}>
      <View style={styles.previewTop}>
        <PinArt theme={quest.collectible.theme} rarity={quest.collectible.rarity} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.heading} numberOfLines={2}>
            {quest.title}
          </Text>
          <Text style={type.small} numberOfLines={1}>
            {landmark.name}
          </Text>
        </View>
      </View>
      <MetaRow
        items={[
          { icon: 'walk', label: `${walkingMinutes(distanceM)} min walk` },
          { icon: 'timer-outline', label: `${quest.durationMin} min` },
          { icon: 'star-four-points-outline', label: `${quest.xp} XP` },
        ]}
      />
      <Text style={[type.tiny, { color: colors.textFaint }]}>{quest.source === 'gemini' ? 'Written with Gemini' : 'Built-in quest'}</Text>
      <Button label={actionLabel} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  preview: { gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
