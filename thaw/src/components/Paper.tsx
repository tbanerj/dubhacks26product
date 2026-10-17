import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, cutout, fonts, radii, spacing, type } from '../theme/tokens';
import type { IconName } from '../theme/palette';

/** Paper-cutout card: ink outline, thick bottom edge, hard offset shadow. */
export function Card({ children, style, tint = colors.white }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return <View style={[styles.card, { backgroundColor: tint }, style]}>{children}</View>;
}

export function Chip({ label, icon, bg = colors.paperDeep, fg = colors.ink, style }: { label: string; icon?: IconName; bg?: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]} accessible accessibilityLabel={label}>
      {icon && <MaterialCommunityIcons name={icon} size={14} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.heading} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={34} color={colors.forest} />
      </View>
      <Text style={[type.subheading, { textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[type.small, { textAlign: 'center' }]}>{body}</Text>}
      {action}
    </View>
  );
}

export function Notice({ icon = 'information-outline', text, tone = 'info' }: { icon?: IconName; text: string; tone?: 'info' | 'warn' | 'demo' }) {
  const bg = tone === 'warn' ? colors.sunsetSoft : tone === 'demo' ? colors.butterSoft : colors.skySoft;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="text">
      <MaterialCommunityIcons name={icon} size={18} color={colors.ink} />
      <Text style={[type.small, { color: colors.ink, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ fraction, color = colors.grass, height = 14, label }: { fraction: number; color?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    padding: spacing.lg,
    ...cutout(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.grassSoft,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  track: { backgroundColor: colors.paperDeep, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden' },
});
