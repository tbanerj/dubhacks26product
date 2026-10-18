import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme/useTheme';

export type GlassVariant = 'regular' | 'clear';

/**
 * Native Liquid Glass for controls. Content cards should use a solid surface.
 * The glass is left untinted so it samples what is behind it. Opacity is not animated.
 */
export function GlassSurface({
  children,
  style,
  variant = 'regular',
  tintColor,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GlassVariant;
  tintColor?: string;
}) {
  const { colors, scheme, reduceTransparency, shadow } = useTheme();
  if (canUseLiquidGlass() && !reduceTransparency) {
    return (
      <GlassView style={style} glassEffectStyle={variant} colorScheme={scheme} tintColor={tintColor} isInteractive={false}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, shadow, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function canUseLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
