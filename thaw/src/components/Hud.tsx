import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/useGameStore';
import { levelProgress } from '../game/progression';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Critter } from './Critter';
import { ProgressBar } from './Paper';
import { t } from '../i18n/strings';

/** Top-left player plate: avatar, level and XP progress. */
export function PlayerPlate({ onPress }: { onPress: () => void }) {
  const name = useGameStore((s) => s.player.name);
  const hue = useGameStore((s) => s.player.avatarHue);
  const xp = useGameStore((s) => s.progress.totalXp);
  const lp = levelProgress(xp);
  return (
    <Pressable onPress={onPress} style={styles.plate} accessibilityRole="button" accessibilityLabel={`${name}, level ${lp.level}, ${lp.toNext} XP to next level. Open profile.`}>
      <View style={styles.avatar}>
        <Critter hue={hue} size={40} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.level}>{t('profile.level', { level: lp.level })}</Text>
        </View>
        <ProgressBar fraction={lp.fraction} height={10} label="XP to next level" />
      </View>
    </Pressable>
  );
}

export function DemoBadge({ compact }: { compact?: boolean }) {
  return (
    <View style={styles.demo} accessibilityLabel="Demo mode is on: some features are simulated">
      <MaterialCommunityIcons name="flask-outline" size={14} color={colors.ink} />
      {!compact && <Text style={styles.demoText}>{t('demo.badge')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 200,
    flex: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.butterSoft, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, flexShrink: 1 },
  level: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.forest },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.butter,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  demoText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
});
