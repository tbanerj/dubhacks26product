import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { haptic } from '../utils/haptics';
import { TOUCH } from '../theme/tokens';
import { motion, stopAndTiming } from '../theme/motion';
import { useTheme } from '../theme/useTheme';
import type { IconName } from '../theme/palette';
import { GlassSurface, type GlassVariant } from './GlassSurface';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { colors, radii, type, reduceMotion } = useTheme();
  const v = variant === 'sunset' ? 'primary' : variant;
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
  }[v];
  const inactive = disabled || loading;
  const opacity = useRef(new Animated.Value(inactive && !loading ? 0.45 : 1)).current;
  const resting = inactive && !loading ? 0.45 : 1;

  useEffect(() => {
    stopAndTiming(opacity, resting, motion.press, reduceMotion);
  }, [opacity, resting, reduceMotion]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => {
        if (!inactive) stopAndTiming(opacity, 0.88, motion.press, reduceMotion);
      }}
      onPressOut={() => stopAndTiming(opacity, resting, motion.press, reduceMotion)}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[
        styles.face,
        compact && styles.compact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radii.pill,
          opacity,
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
    </AnimatedPressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  glass,
  glassVariant = 'regular',
  color,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  glass?: boolean;
  glassVariant?: GlassVariant;
  color?: string;
  disabled?: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const glyph = color ?? colors.text;
  const opacity = useRef(new Animated.Value(disabled ? 0.45 : 1)).current;
  const resting = disabled ? 0.45 : 1;
  useEffect(() => {
    stopAndTiming(opacity, resting, motion.press, reduceMotion);
  }, [opacity, resting, reduceMotion]);
  const face = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) stopAndTiming(opacity, 0.75, motion.press, reduceMotion);
      }}
      onPressOut={() => stopAndTiming(opacity, resting, motion.press, reduceMotion)}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={styles.iconBtn}
    >
      <Animated.View style={{ opacity }}>
        <MaterialCommunityIcons name={icon} size={22} color={glyph} />
      </Animated.View>
    </Pressable>
  );
  if (!glass) return face;
  return (
    <GlassSurface style={styles.glassBtn} variant={glassVariant}>
      {face}
    </GlassSurface>
  );
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
