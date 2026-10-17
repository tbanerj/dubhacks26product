import React, { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { haptic } from '../utils/haptics';
import { colors, fonts, radii, spacing, TOUCH } from '../theme/tokens';
import type { IconName } from '../theme/palette';

type Variant = 'primary' | 'secondary' | 'sunset' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; edge: string }> = {
  primary: { bg: colors.forest, fg: colors.paper, border: colors.ink, edge: colors.forestDeep },
  secondary: { bg: colors.paper, fg: colors.ink, border: colors.ink, edge: colors.ink },
  sunset: { bg: colors.sunset, fg: colors.ink, border: colors.ink, edge: colors.sunsetDeep },
  ghost: { bg: 'transparent', fg: colors.forest, border: 'transparent', edge: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.berry, border: colors.berry, edge: colors.berry },
};

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

/** Chunky "pressable sticker" button: sinks into its edge on press. */
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, compact, style, accessibilityHint }: ButtonProps) {
  const v = VARIANTS[variant];
  const [press] = useState(() => new Animated.Value(0));
  const inactive = disabled || loading;
  const edge = variant === 'ghost' ? 0 : 4;

  const animate = (to: number) => Animated.spring(press, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[styles.wrap, { opacity: inactive && !loading ? 0.5 : 1, paddingBottom: edge }, style]}
      hitSlop={compact ? 6 : 0}
    >
      {edge > 0 && <View style={[styles.edge, { backgroundColor: v.edge, top: edge }]} />}
      <Animated.View
        style={[
          styles.face,
          compact && styles.compact,
          { backgroundColor: v.bg, borderColor: v.border, transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, edge] }) }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {icon && <MaterialCommunityIcons name={icon} size={compact ? 18 : 20} color={v.fg} />}
            <Text style={[styles.label, compact && styles.labelCompact, { color: v.fg }]} numberOfLines={1}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: TOUCH, position: 'relative' },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: radii.md },
  face: {
    minHeight: TOUCH + 6,
    borderRadius: radii.md,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  compact: { minHeight: TOUCH - 4, paddingHorizontal: spacing.md },
  label: { fontFamily: fonts.display, fontSize: 17 },
  labelCompact: { fontSize: 15 },
});
