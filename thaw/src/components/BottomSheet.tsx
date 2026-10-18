import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { springs } from '../theme/motion';

/**
 * Two-snap sheet. The handle and peek drag between `collapsed` and `expanded`.
 * List content below the peek scrolls only while expanded, so the map keeps its gestures.
 */
export function BottomSheet({
  collapsed,
  expanded,
  peek,
  children,
  style,
  onExpandedChange,
}: {
  collapsed: number;
  expanded: number;
  peek: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const { colors, radii, reduceMotion, shadow } = useTheme();
  const [height] = useState(() => new Animated.Value(collapsed));
  const [dragStart] = useState(() => ({ value: collapsed }));
  const [open, setOpen] = useState(false);

  const runtime = useRef({ collapsed, expanded, reduceMotion, onExpandedChange });
  runtime.current = { collapsed, expanded, reduceMotion, onExpandedChange };

  useEffect(() => {
    if (open) return;
    height.setValue(collapsed);
  }, [collapsed, height, open]);

  const snap = (toExpanded: boolean) => {
    const current = runtime.current;
    const to = toExpanded ? current.expanded : current.collapsed;
    setOpen(toExpanded);
    current.onExpandedChange?.(toExpanded);
    if (current.reduceMotion) {
      height.setValue(to);
      return;
    }
    Animated.spring(height, { toValue: to, ...springs.layout }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        height.stopAnimation((value) => {
          dragStart.value = value;
        });
      },
      onPanResponderMove: (_, g) => {
        const { collapsed: min, expanded: max } = runtime.current;
        height.setValue(clamp(dragStart.value - g.dy, min, max));
      },
      onPanResponderRelease: (_, g) => {
        height.stopAnimation((current) => {
          const { collapsed: min, expanded: max } = runtime.current;
          const midpoint = (min + max) / 2;
          snap(g.vy < -0.45 || (g.vy < 0.45 && current > midpoint));
        });
      },
      onPanResponderTerminate: () => {
        height.stopAnimation((current) => {
          const { collapsed: min, expanded: max } = runtime.current;
          snap(current > (min + max) / 2);
        });
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.sheet, shadow, { height, backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl }, style]}>
      <View {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={open ? 'Quest list, expanded' : 'Quest preview, collapsed'} accessibilityHint="Drag up or down">
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {peek}
      </View>
      <View style={styles.body} pointerEvents="auto">
        {children}
      </View>
    </Animated.View>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const styles = StyleSheet.create({
  sheet: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 8 },
  body: { flex: 1 },
});
