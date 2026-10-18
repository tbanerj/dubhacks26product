import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../utils/haptics';
import { useTheme } from '../theme/useTheme';
import { stopAndSpring } from '../theme/motion';
import type { IconName } from '../theme/palette';
import { t, type StringKey } from '../i18n/strings';
import { useGameStore } from '../store/useGameStore';
import { unseenCollectibleCount, unreadChatCount } from '../game/attention';
import { GlassSurface } from '../components/GlassSurface';
import { indexForPoint, releaseDecision, shouldHapticOnEnter, stabilizedIndex, TAB_SLOP, type TabFrame } from './tabSlide';
import type { TabParamList } from './types';

const TABS: Record<string, { icon: IconName; iconActive: IconName; label: StringKey }> = {
  Explore: { icon: 'compass-outline', iconActive: 'compass', label: 'tabs.explore' },
  Party: { icon: 'account-group-outline', iconActive: 'account-group', label: 'tabs.party' },
  Collection: { icon: 'book-outline', iconActive: 'book-open-variant', label: 'tabs.collection' },
  You: { icon: 'account-outline', iconActive: 'account', label: 'tabs.profile' },
};

const TAP_SLOP = 10;

/** Glass tab bar. The route index is the only selected-tab state. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, type, reduceMotion } = useTheme();
  const unread = useGameStore((s) => unreadChatCount(s.chat, s.lastChatReadAt, s.player.id));
  const unseen = useGameStore((s) => unseenCollectibleCount(s.progress.collectibles, s.seenCollectibleIds));
  const [candidate, setCandidate] = useState<number | null>(null);
  const [pillWidth, setPillWidth] = useState(0);
  const pillWidthRef = useRef(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const frames = useRef<TabFrame[]>([]);
  const origin = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const measured = useRef(false);
  const rowRef = useRef<View>(null);
  const dragging = useRef(false);
  const ignorePress = useRef(false);
  const candidateRef = useRef<number | null>(null);
  const runtime = useRef({ state, navigation, reduceMotion });
  runtime.current = { state, navigation, reduceMotion };

  const measureRow = () => {
    rowRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0) return;
      origin.current = { x, y, width, height };
      measured.current = true;
    });
  };

  const rememberWidth = (width: number) => {
    if (Math.abs(width - pillWidthRef.current) < 0.5) return;
    pillWidthRef.current = width;
    setPillWidth(width);
  };

  const moveIndicator = (index: number, animate: boolean) => {
    const frame = frames.current[index];
    if (!frame) return;
    rememberWidth(frame.width);
    if (!animate) {
      indicatorX.stopAnimation();
      indicatorX.setValue(frame.x);
      return;
    }
    stopAndSpring(indicatorX, frame.x, runtime.current.reduceMotion, 'indicator');
  };

  useEffect(() => {
    if (dragging.current) return;
    moveIndicator(state.index, true);
    // Frames live in a ref; layout updates them and snaps the indicator itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, reduceMotion]);

  const point = (e: GestureResponderEvent) => {
    if (!measured.current) return { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    return { x: e.nativeEvent.pageX - origin.current.x, y: e.nativeEvent.pageY - origin.current.y };
  };

  const track = (e: GestureResponderEvent) => {
    const p = point(e);
    const next = stabilizedIndex(p.x, p.y, origin.current.height, frames.current, candidateRef.current);
    const width = (next != null ? frames.current[next]?.width : frames.current[runtime.current.state.index]?.width) ?? 0;
    if (width > 0) {
      const max = Math.max(0, origin.current.width - width);
      indicatorX.setValue(Math.min(max, Math.max(0, p.x - width / 2)));
      rememberWidth(width);
    }
    if (next === candidateRef.current) return;
    const previous = candidateRef.current;
    candidateRef.current = next;
    setCandidate(next);
    if (shouldHapticOnEnter(previous, next, runtime.current.state.index) && !runtime.current.reduceMotion) haptic.tap();
  };

  const finish = (index: number | null, source: 'tap' | 'slide') => {
    dragging.current = false;
    candidateRef.current = null;
    setCandidate(null);
    const current = runtime.current;
    const decision = releaseDecision(index, current.state.index);
    const route = current.state.routes[decision.index];
    if (!route || !TABS[route.name]) {
      moveIndicator(current.state.index, true);
      return;
    }
    if (!decision.navigate) {
      if (source === 'tap') current.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      moveIndicator(current.state.index, true);
      return;
    }
    const event = current.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) {
      moveIndicator(current.state.index, true);
      return;
    }
    if (source === 'tap' && !current.reduceMotion) haptic.tap();
    current.navigation.navigate(route.name as keyof TabParamList);
    moveIndicator(decision.index, true);
  };

  const releaseLater = () => {
    setTimeout(() => {
      ignorePress.current = false;
    }, 350);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > TAP_SLOP && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        ignorePress.current = true;
        dragging.current = true;
        indicatorX.stopAnimation();
        measureRow();
      },
      onPanResponderMove: (e, g) => {
        if (Math.hypot(g.dx, g.dy) <= TAP_SLOP) return;
        track(e);
      },
      onPanResponderRelease: (e, g) => {
        if (Math.hypot(g.dx, g.dy) <= TAP_SLOP) {
          const p = point(e);
          finish(indexForPoint(p.x, p.y, origin.current.height, frames.current, TAB_SLOP), 'tap');
        } else {
          finish(candidateRef.current, 'slide');
        }
        releaseLater();
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        candidateRef.current = null;
        setCandidate(null);
        moveIndicator(runtime.current.state.index, true);
        releaseLater();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const onRowLayout = (e: LayoutChangeEvent) => {
    origin.current = { ...origin.current, width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
    measureRow();
  };

  const onTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    frames.current[index] = { x, width };
    if (!dragging.current && index === runtime.current.state.index) {
      indicatorX.stopAnimation();
      indicatorX.setValue(x);
      rememberWidth(width);
    }
  };

  const emphasized = candidate ?? state.index;

  return (
    <View style={[styles.outer, { left: Math.max(12, insets.left), right: Math.max(12, insets.right), paddingBottom: Math.max(insets.bottom, 8) }]}>
      <GlassSurface style={styles.bar} variant="regular">
        <View
          ref={rowRef}
          style={styles.row}
          onLayout={onRowLayout}
          accessibilityRole="tablist"
          accessibilityLabel="Main navigation"
          {...pan.panHandlers}
        >
          {pillWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { width: pillWidth, backgroundColor: colors.sageSoft, transform: [{ translateX: indicatorX }] }]}
            />
          )}
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const cfg = TABS[route.name];
            if (!cfg) return null;
            const count = route.name === 'Party' ? unread : route.name === 'Collection' ? unseen : 0;
            const badge = count > 0 ? (count > 9 ? '9+' : String(count)) : null;
            const label = t(cfg.label);
            const hot = emphasized === index;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                aria-selected={focused}
                ref={(node) => {
                  const el = node as unknown as { setAttribute?: (name: string, value: string) => void } | null;
                  el?.setAttribute?.('aria-selected', focused ? 'true' : 'false');
                }}
                accessibilityLabel={badge ? `${label}, ${badge} new` : label}
                onLayout={onTabLayout(index)}
                onPress={() => {
                  if (ignorePress.current) return;
                  finish(index, 'tap');
                }}
                style={styles.tab}
              >
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons name={hot ? cfg.iconActive : cfg.icon} size={22} color={hot ? colors.primary : colors.textSecondary} />
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[type.tiny, styles.tabLabel, { color: hot ? colors.primary : colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.4}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute', bottom: 0, zIndex: 20, elevation: 16 },
  tabLabel: { alignSelf: 'stretch', textAlign: 'center' },
  bar: { borderRadius: 28 },
  row: { flexDirection: 'row', overflow: 'hidden', borderRadius: 28 },
  indicator: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2 },
  iconWrap: { width: 46, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

/** Body of the floating bar, excluding the home-indicator inset. */
export const TAB_BAR_BODY = 72;

export function tabBarOffset(bottomInset: number): number {
  return TAB_BAR_BODY + Math.max(bottomInset, 8) + 16;
}

/** Fallback for call sites that have not measured the inset yet. */
export const TAB_BAR_SPACE = 108;
