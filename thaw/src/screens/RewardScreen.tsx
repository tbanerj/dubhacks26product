import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { Confetti } from '../components/Confetti';
import { Critter } from '../components/Critter';
import { PinArt } from '../components/PinArt';
import { Button } from '../components/Button';
import { Card, ProgressBar } from '../components/Paper';
import { useTheme } from '../theme/useTheme';
import { RARITY_STYLE } from '../theme/palette';
import { levelProgress } from '../game/progression';
import { t } from '../i18n/strings';

export function RewardScreen({ navigation }: RootScreenProps<'Reward'>) {
  const insets = useSafeAreaInsets();
  const { colors, type, reduceMotion } = useTheme();
  const reward = useGameStore((s) => s.lastReward);
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);
  const photo = useGameStore((s) => s.pendingEvidenceUri);
  const clearLastReward = useGameStore((s) => s.clearLastReward);
  const [xpShown, setXpShown] = useState(0);

  useEffect(() => {
    if (!reward || reduceMotion) return;
    const start = Date.now();
    const id = setInterval(() => {
      const f = Math.min(1, (Date.now() - start) / 700);
      setXpShown(Math.round(reward.xpGained * (1 - Math.pow(1 - f, 3))));
      if (f >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [reward, reduceMotion]);

  const finish = (to: 'Explore' | 'Collection') => {
    clearLastReward();
    navigation.navigate('Tabs', { screen: to });
  };

  if (!reward) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + 24, padding: 20, gap: 16 }]}>
        <Text style={type.title}>All caught up!</Text>
        <Button label={t('reward.done')} onPress={() => finish('Explore')} />
      </View>
    );
  }

  const lp = levelProgress(progress.totalXp);
  const leveled = reward.levelAfter > reward.levelBefore;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24, gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          {reward.collectible ? <PinArt theme={reward.collectible.theme} rarity={reward.collectible.rarity} size={148} /> : <Critter hue={player.avatarHue} size={96} mood="happy" />}
          <Text style={type.title} accessibilityRole="header">
            {t('reward.title')}
          </Text>
          <Text style={[type.hero, { color: colors.primary }]} accessibilityLabel={`${reward.xpGained} XP earned`}>
            +{(reduceMotion ? reward.xpGained : xpShown)} XP
          </Text>
        </View>

        <Card style={{ gap: 8 }}>
          {leveled && (
            <Text style={type.subheading} accessibilityLiveRegion="polite">
              {t('reward.levelUp', { level: reward.levelAfter })}
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.subheading}>{t('profile.level', { level: lp.level })}</Text>
            <Text style={type.small}>
              {lp.intoLevel} / {lp.levelSpan} XP
            </Text>
          </View>
          <ProgressBar fraction={lp.fraction} label="Level progress" />
          {reward.collectible ? (
            <Text style={type.small}>
              {reward.collectible.name} · {RARITY_STYLE[reward.collectible.rarity].label}
              {reward.newLandmark ? ' · New place' : ''}
            </Text>
          ) : (
            <Text style={type.small}>You already own this place’s pin. XP still counts.</Text>
          )}
          {reward.streak > 1 ? <Text style={type.small}>{reward.streak}-day streak</Text> : null}
        </Card>

        {photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Submitted evidence" /> : null}

        <Button label={t('reward.done')} onPress={() => finish('Explore')} />
        <Button label={t('reward.collection')} variant="secondary" onPress={() => finish('Collection')} />
      </ScrollView>
      {reduceMotion ? null : <Confetti count={18} duration={1400} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  photo: { width: '100%', height: 180, borderRadius: 20 },
});
