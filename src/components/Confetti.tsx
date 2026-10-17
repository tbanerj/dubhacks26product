import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme/tokens';

const PALETTE = [colors.sunset, colors.butter, colors.grass, colors.forest, colors.sky, colors.berry];

/**
 * One-shot paper-confetti burst. Uses the core Animated API with the native driver
 * (transform/opacity only), so it runs off the JS thread and never blocks taps:
 * the overlay has pointerEvents="none".
 */
export function Confetti({ count = 36, duration = 2200 }: { count?: number; duration?: number }) {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => {
          const x = Math.sin(i * 9301 + n * 49297) * 233280;
          return x - Math.floor(x);
        };
        return {
          x: r(1) * width,
          drift: (r(2) - 0.5) * 120,
          delay: r(3) * 0.25,
          spin: (r(4) > 0.5 ? 1 : -1) * (360 + r(5) * 540),
          w: 7 + r(6) * 7,
          h: 10 + r(7) * 8,
          color: PALETTE[i % PALETTE.length] ?? colors.sunset,
          round: r(8) > 0.7,
        };
      }),
    [count, width],
  );

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [duration, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => {
        const t = progress.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -24,
              width: p.w,
              height: p.h,
              borderRadius: p.round ? p.w : 2,
              backgroundColor: p.color,
              borderWidth: 1,
              borderColor: colors.ink,
              opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.85] }) },
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
