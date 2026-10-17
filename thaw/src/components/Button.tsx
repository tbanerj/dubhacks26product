import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { haptic } from '../utils/haptics';
import { TOUCH } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { IconName } from '../theme/palette';
import { GlassSurface } from './GlassSurface';

type Variant = 'primary' | 'secondary' | 'sunset' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/** Primary and secondary actions. `sunset` matches primary so older call sites stay on the forest accent. */
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, compact, style, accessibilityHint }: ButtonProps) {
  const { colors, radii, type } = useTheme();
  const v = variant === 'sunset' ? 'primary' : variant;
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
  }[v];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.face,
        compact && styles.compact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radii.pill,
          opacity: inactive && !loading ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <MaterialCommunityIcons name={icon} size={compact ? 18 : 20} color={palette.fg} />}
          <Text style={[type.bodyStrong, { color: palette.fg, fontSize: compact ? 15 : 16 }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  glass,
  color,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  glass?: boolean;
  color?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const glyph = color ?? colors.text;
  const face = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.iconBtn, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={glyph} />
    </Pressable>
  );
  if (!glass) return face;
  return <GlassSurface style={styles.glassBtn}>{face}</GlassSurface>;
}

const styles = StyleSheet.create({
  face: {
    minHeight: TOUCH + 4,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compact: { minHeight: TOUCH, paddingHorizontal: 14 },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  glassBtn: { width: TOUCH, height: TOUCH, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
