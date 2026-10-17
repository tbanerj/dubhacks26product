import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../utils/haptics';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import type { IconName } from '../theme/palette';
import { t, type StringKey } from '../i18n/strings';
import { useGameStore } from '../store/useGameStore';

const TABS: Record<string, { icon: IconName; iconActive: IconName; label: StringKey }> = {
  Explore: { icon: 'compass-outline', iconActive: 'compass', label: 'tabs.explore' },
  Party: { icon: 'account-group-outline', iconActive: 'account-group', label: 'tabs.party' },
  Collection: { icon: 'pin-outline', iconActive: 'pin', label: 'tabs.collection' },
  Leaderboard: { icon: 'trophy-outline', iconActive: 'trophy', label: 'tabs.leaderboard' },
  Profile: { icon: 'account-circle-outline', iconActive: 'account-circle', label: 'tabs.profile' },
};

/** Floating paper tab bar with a sticker-style active tab. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const partyCount = useGameStore((s) => s.party?.members.length ?? 0);
  const pins = useGameStore((s) => s.progress.collectibles.length);

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const cfg = TABS[route.name];
          if (!cfg) return null;
          const badge = route.name === 'Party' && partyCount > 0 ? String(partyCount) : route.name === 'Collection' && pins > 0 ? String(pins) : null;
          const label = t(cfg.label);
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badge}` : label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic.tap();
                  navigation.navigate(route.name, undefined);
                }
              }}
              style={styles.tab}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <MaterialCommunityIcons name={focused ? cfg.iconActive : cfg.icon} size={24} color={focused ? colors.ink : colors.inkSoft} />
                {badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: 'transparent', paddingHorizontal: spacing.md, position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.ink,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2 },
  iconWrap: { width: 46, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.butter, borderWidth: 2, borderColor: colors.ink },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.inkSoft },
  labelActive: { fontFamily: fonts.bodyBold, color: colors.ink },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.sunset,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.ink },
});

/** Height to pad scroll content so it clears the floating tab bar. */
export const TAB_BAR_SPACE = 100;
