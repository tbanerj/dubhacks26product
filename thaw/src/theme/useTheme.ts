import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useGameStore } from '../store/useGameStore';
import { darkColors, lightColors, makeType, radii, softShadow, spacing, type AppearancePreference } from './tokens';

export function useTheme() {
  const appearance = useGameStore((s) => s.settings.appearance ?? 'system');
  const system = useColorScheme();
  const scheme: 'light' | 'dark' = resolveScheme(appearance, system);
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduceMotion(value);
    });
    const transparency = (AccessibilityInfo as { isReduceTransparencyEnabled?: () => Promise<boolean> }).isReduceTransparencyEnabled;
    if (transparency) {
      void transparency.call(AccessibilityInfo).then((value) => {
        if (alive) setReduceTransparency(value);
      });
    }
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    let transparencySub: { remove: () => void } | undefined;
    try {
      transparencySub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    } catch {
      transparencySub = undefined;
    }
    return () => {
      alive = false;
      motionSub.remove();
      transparencySub?.remove();
    };
  }, []);

  const typography = useMemo(() => makeType(colors), [colors]);
  return { colors, scheme, type: typography, spacing, radii, reduceMotion, reduceTransparency, shadow: softShadow, appearance };
}

export function resolveScheme(appearance: AppearancePreference, system: string | null | undefined): 'light' | 'dark' {
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}
