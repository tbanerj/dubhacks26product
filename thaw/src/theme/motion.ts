import { Animated, Easing } from 'react-native';

/** Durations are design targets for this app, tuned for React Native's Animated API. */
export const motion = {
  press: 140,
  selection: 200,
  layout: 300,
  map: 320,
} as const;

/** friction/tension springs. Do not mix these with Reanimated's damping/stiffness config. */
export const springs = {
  indicator: { friction: 12, tension: 90, useNativeDriver: true },
  layout: { friction: 12, tension: 90, useNativeDriver: false },
} as const;

export function stopAndSpring(value: Animated.Value, to: number, reduceMotion: boolean, kind: keyof typeof springs = 'indicator') {
  value.stopAnimation();
  if (reduceMotion) {
    value.setValue(to);
    return;
  }
  Animated.spring(value, { toValue: to, ...springs[kind] }).start();
}

export function stopAndTiming(value: Animated.Value, to: number, duration: number, reduceMotion: boolean, native = true) {
  value.stopAnimation();
  if (reduceMotion) {
    value.setValue(to);
    return;
  }
  Animated.timing(value, { toValue: to, duration, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
}
