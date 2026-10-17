import React, { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { Confetti } from '../components/Confetti';
import { Critter } from '../components/Critter';
import { PinArt } from '../components/PinArt';
import { Button } from '../components/Button';
import { Card, ProgressBar } from '../components/Paper';
import { colors, fonts, spacing, type } from '../theme/tokens';
import { RARITY_STYLE, THEME_STYLE } from '../theme/palette';
import { levelProgress } from '../game/progression';
import { buildLeaderboard } from '../game/leaderboard';
import { t } from '../i18n/strings';

function usePop(delay: number) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 })]).start();
  }, [delay, v]);
  return { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };
}

export function RewardScreen({ navigation }: RootScreenProps<'Reward'>) {
  const insets = useSafeAreaInsets();
  const reward = useGameStore((s) => s.lastReward);
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);
  const clearLastReward = useGameStore((s) => s.clearLastReward);
  const [xpShown, setXpShown] = useState(0);

  const header = usePop(0);
  const xpPop = usePop(350);
  const levelPop = usePop(800);
  const pinPop = usePop(1100);
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!reward) return;
    // Count-up for the XP number (JS-driven, short and cheap).
    const start = Date.now();
    const id = setInterval(() => {
      const f = Math.min(1, (Date.now() - start) / 900);
      setXpShown(Math.round(reward.xpGained * (1 - Math.pow(1 - f, 3))));
      if (f >= 1) clearInterval(id);
    }, 30);
    Animated.timing(spin, { toValue: 1, duration: 900, delay: 1100, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    return () => clearInterval(id);
  }, [reward, spin]);

  if (!reward) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.xl, padding: spacing.lg }]}>
        <Text style={type.title}>All caught up!</Text>
        <Button label={t('reward.done')} onPress={() => navigation.navigate('Tabs', { screen: 'Explore' })} />
      </View>
    );
  }

  const lp = levelProgress(progress.totalXp);
  const leveled = reward.levelAfter > reward.levelBefore;
  const rank = buildLeaderboard('daily', player, progress).find((r) => r.isSelf)?.rank ?? null;
  const finish = (to: 'Explore' | 'Collection' | 'Leaderboard') => {
    clearLastReward();
    navigation.navigate('Tabs', { screen: to });
  };

  return (
    <View style={styles.root}>
      <View style={styles.sunburst} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg, alignItems: 'stretch' }}>
        <Animated.View style={[{ alignItems: 'center', gap: spacing.xs }, header]}>
          <Critter hue={player.avatarHue} size={110} mood="wow" />
          <Text style={[type.tiny, { color: colors.forest }]}>VERIFIED {reward.newLandmark ? '· NEW PLACE DISCOVERED' : ''}</Text>
          <Text style={[type.hero, { textAlign: 'center' }]} accessibilityRole="header">
            {t('reward.title')}
          </Text>
        </Animated.View>

        <Animated.View style={xpPop}>
          <Card tint={colors.butter} style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text style={styles.xp} accessibilityLabel={`${reward.xpGained} XP earned`}>
              +{xpShown} XP
            </Text>
            <Text style={type.small}>
              {reward.newLandmark ? 'Includes first-visit bonus · ' : ''}
              {reward.streak > 1 ? `${reward.streak}-day streak 🔥` : 'Streak started 🔥'}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View style={levelPop}>
          <Card tint={colors.white} style={{ gap: spacing.sm }}>
            {leveled && (
              <View style={styles.levelUp} accessibilityLiveRegion="polite">
                <Text style={styles.levelUpText}>{t('reward.levelUp', { level: reward.levelAfter })}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.subheading}>{t('profile.level', { level: lp.level })}</Text>
              <Text style={type.small}>{lp.toNext} XP to next</Text>
            </View>
            <ProgressBar fraction={lp.fraction} label="Level progress" />
            {rank && <Text style={type.small}>You’re #{rank} on today’s local board.</Text>}
          </Card>
        </Animated.View>

        {reward.collectible ? (
          <Animated.View style={pinPop}>
            <Card tint={THEME_STYLE[reward.collectible.theme].base} style={{ alignItems: 'center', gap: spacing.xs }}>
              <Text style={type.tiny}>{t('reward.newPin').toUpperCase()}</Text>
              <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '0deg'] }) }] }}>
                <PinArt theme={reward.collectible.theme} rarity={reward.collectible.rarity} size={128} />
              </Animated.View>
              <Text style={type.heading}>{reward.collectible.name}</Text>
              <Text style={type.small}>
                {RARITY_STYLE[reward.collectible.rarity].label} · {reward.collectible.landmarkName}
              </Text>
            </Card>
          </Animated.View>
        ) : (
          <Text style={[type.small, { textAlign: 'center' }]}>You already own this place’s pin – XP still counts!</Text>
        )}

        <View style={{ gap: spacing.sm }}>
          {reward.collectible && <Button label={t('reward.collection')} icon="pin" variant="sunset" onPress={() => finish('Collection')} />}
          <Button label={t('reward.ranks')} icon="trophy-outline" variant="secondary" onPress={() => finish('Leaderboard')} />
          <Button label={t('reward.done')} icon="compass-outline" variant="ghost" onPress={() => finish('Explore')} />
        </View>
      </ScrollView>
      <Confetti />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, overflow: 'hidden' },
  sunburst: { position: 'absolute', top: -160, alignSelf: 'center', width: 520, height: 520, borderRadius: 260, backgroundColor: colors.butterSoft },
  xp: { fontFamily: fonts.displayBold, fontSize: 48, color: colors.ink },
  levelUp: { backgroundColor: colors.sunset, borderWidth: 2, borderColor: colors.ink, borderRadius: 12, padding: spacing.sm, alignItems: 'center' },
  levelUpText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
});
