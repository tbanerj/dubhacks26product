import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme/useTheme';

/**
 * Native Liquid Glass on iOS 26+ when the API is available and the user has not
 * asked for reduced transparency. Every other case gets an opaque surface —
 * not the library's plain View.
 */
export function GlassSurface({ children, style, tint }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  const { colors, scheme, reduceTransparency, shadow } = useTheme();
  const native = canUseLiquidGlass() && !reduceTransparency;
  if (native) {
    return (
      <GlassView
        style={[styles.clip, style]}
        glassEffectStyle="regular"
        tintColor={tint ?? (scheme === 'dark' ? '#1C2420' : '#F8F8F3')}
        colorScheme={scheme}
        isInteractive={false}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, shadow, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function canUseLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
