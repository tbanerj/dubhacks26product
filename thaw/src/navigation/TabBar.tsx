import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../utils/haptics';
import { useTheme } from '../theme/useTheme';
import type { IconName } from '../theme/palette';
import { t, type StringKey } from '../i18n/strings';
import { useGameStore } from '../store/useGameStore';
import { unseenCollectibleCount, unreadChatCount } from '../game/attention';
import { GlassSurface } from '../components/GlassSurface';

const TABS: Record<string, { icon: IconName; iconActive: IconName; label: StringKey }> = {
  Explore: { icon: 'compass-outline', iconActive: 'compass', label: 'tabs.explore' },
  Party: { icon: 'account-group-outline', iconActive: 'account-group', label: 'tabs.party' },
  Collection: { icon: 'book-outline', iconActive: 'book-open-variant', label: 'tabs.collection' },
  You: { icon: 'account-outline', iconActive: 'account', label: 'tabs.profile' },
};

/** Glass tab bar. Badges are unread chat and unseen pins, not running totals. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, type } = useTheme();
  const unread = useGameStore((s) => unreadChatCount(s.chat, s.lastChatReadAt, s.player.id));
  const unseen = useGameStore((s) => unseenCollectibleCount(s.progress.collectibles, s.seenCollectibleIds));

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <GlassSurface style={styles.bar}>
        <View style={styles.row} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const cfg = TABS[route.name];
            if (!cfg) return null;
            const count = route.name === 'Party' ? unread : route.name === 'Collection' ? unseen : 0;
            const badge = count > 0 ? (count > 9 ? '9+' : String(count)) : null;
            const label = t(cfg.label);
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${label}, ${badge} new` : label}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    haptic.tap();
                    navigation.navigate(route.name, undefined);
                  }
                }}
                style={styles.tab}
              >
                <View style={[styles.iconWrap, focused && { backgroundColor: colors.sageSoft }]}>
                  <MaterialCommunityIcons name={focused ? cfg.iconActive : cfg.icon} size={22} color={focused ? colors.primary : colors.textSecondary} />
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[type.tiny, { color: focused ? colors.primary : colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
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
  outer: { position: 'absolute', left: 12, right: 12, bottom: 0 },
  bar: { borderRadius: 28, overflow: 'hidden' },
  row: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6 },
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
