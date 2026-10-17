import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import type { IconName } from '../theme/palette';

export function Card({ children, style, tint }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  const { colors, radii, shadow } = useTheme();
  return <View style={[styles.card, shadow, { backgroundColor: tint ?? colors.surface, borderColor: colors.border, borderRadius: radii.lg }, style]}>{children}</View>;
}

export function Chip({ label, icon, bg, fg, style }: { label: string; icon?: IconName; bg?: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  const { colors, radii, type } = useTheme();
  const background = bg ?? colors.surfaceMuted;
  const color = fg ?? colors.text;
  return (
    <View style={[styles.chip, { backgroundColor: background, borderRadius: radii.pill }, style]} accessible accessibilityLabel={label}>
      {icon && <MaterialCommunityIcons name={icon} size={14} color={color} />}
      <Text style={[type.tiny, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const { type } = useTheme();
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
  const { colors, type } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.sageSoft }]}>
        <MaterialCommunityIcons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[type.subheading, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.small, { textAlign: 'center' }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.empty} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

export function Notice({ icon = 'information-outline', text, tone = 'info' }: { icon?: IconName; text: string; tone?: 'info' | 'warn' | 'demo' }) {
  const { colors, radii, type } = useTheme();
  const bg = tone === 'warn' ? colors.amberSoft : tone === 'demo' ? colors.butterSoft : colors.surfaceMuted;
  const fg = tone === 'demo' ? colors.text : colors.text;
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderRadius: radii.md }]} accessibilityRole="text">
      <MaterialCommunityIcons name={icon} size={16} color={fg} />
      <Text style={[type.small, { color: colors.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ fraction, color, height = 8, label }: { fraction: number; color?: string; height?: number; label?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.surfaceMuted }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color ?? colors.primary, borderRadius: height / 2 }} />
    </View>
  );
}

export function MetaRow({ items }: { items: { icon?: IconName; label: string }[] }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.meta} accessibilityRole="text">
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} style={styles.metaItem}>
          {index > 0 && <Text style={[type.small, { color: colors.textFaint }]}>·</Text>}
          {item.icon && <MaterialCommunityIcons name={item.icon} size={14} color={colors.textSecondary} />}
          <Text style={type.small}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  hint,
  onPress,
  control,
  value,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  onPress?: () => void;
  control?: React.ReactNode;
  value?: string;
}) {
  const { colors, type } = useTheme();
  const body = (
    <View style={[styles.settings, { borderColor: colors.border }]}>
      {icon && <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />}
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{label}</Text>
        {hint ? <Text style={type.small}>{hint}</Text> : null}
      </View>
      {value ? <Text style={type.small}>{value}</Text> : null}
      {control}
      {onPress && !control ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textFaint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={hint ? `${label}. ${hint}` : label} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  empty: { alignItems: 'center', gap: 8, padding: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 12 },
  track: { overflow: 'hidden', width: '100%' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settings: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
