import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, ProgressBar, SettingsRow } from '../components/Paper';
import { IconButton } from '../components/Button';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { regionById } from '../data/regions';
import { currentStreak, dailyXp, levelProgress } from '../game/progression';
import { formatDate, formatNumber } from '../utils/format';
import { t } from '../i18n/strings';

export function YouScreen({ navigation }: TabScreenProps<'You'>) {
  const { colors, type } = useTheme();
  const s = useGameStore(
    useShallow((st) => ({
      player: st.player,
      progress: st.progress,
      syncState: st.syncState,
      account: st.account,
      demoMode: st.settings.demoMode,
      regionId: st.regionId,
    })),
  );
  const setDemoMode = useGameStore((st) => st.setDemoMode);
  const lp = levelProgress(s.progress.totalXp);
  const streak = currentStreak(s.progress);
  const today = dailyXp(s.progress);
  const recent = s.progress.completions.slice(0, 6);

  return (
    <ScreenShell
      title="You"
      tab
      right={<IconButton icon="cog-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />}
    >
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.sageSoft }]}>
          <Critter hue={s.player.avatarHue} size={72} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.title} numberOfLines={1}>
            {s.player.name}
          </Text>
          <Text style={type.small}>{t('profile.level', { level: lp.level })}</Text>
          {s.account ? (
            <Text style={type.tiny}>{s.syncState === 'syncing' ? 'Syncing' : s.syncState === 'offline' ? 'Offline' : s.syncState === 'synced' ? 'Synced' : 'Not synced yet'}</Text>
          ) : null}
          <ProgressBar fraction={lp.fraction} label="XP progress" />
          <Text style={type.tiny}>
            {formatNumber(lp.intoLevel)} / {formatNumber(lp.levelSpan)} XP
          </Text>
        </View>
      </View>
      <Pressable onPress={() => navigation.navigate('EditAvatar')} accessibilityRole="button" accessibilityLabel="Edit avatar">
        <Text style={[type.bodyStrong, { color: colors.primary }]}>Edit avatar</Text>
      </Pressable>

      <Card style={{ paddingVertical: 4 }}>
        <SettingsRow
          icon="flask-outline"
          label="Demo mode"
          hint="Stand in for GPS with a chosen city. Quests, parties, photos, and your account stay real."
          control={
            <Switch
              value={s.demoMode}
              onValueChange={(v) => void setDemoMode(v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="Demo mode"
            />
          }
        />
        {s.demoMode ? (
          <SettingsRow icon="map-marker-outline" label="Demo city" value={regionById(s.regionId)?.name ?? 'Seattle'} onPress={() => navigation.navigate('RegionPicker')} />
        ) : null}
      </Card>

      <View style={[styles.stats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Stat value={streak > 0 ? String(streak) : '0'} label="day streak" />
        <Stat value={formatNumber(s.progress.completions.length)} label={s.progress.completions.length === 1 ? 'quest' : 'quests'} />
        <Stat value={formatNumber(s.progress.visitedLandmarkIds.length)} label={s.progress.visitedLandmarkIds.length === 1 ? 'place' : 'places'} />
      </View>
      <Text style={type.small}>Today · {formatNumber(today)} XP</Text>

      <Card style={{ padding: 0 }}>
        <SettingsRow icon="book-outline" label="Collection" onPress={() => navigation.navigate('Collection')} />
        <SettingsRow icon="trophy-outline" label="Leaderboards" onPress={() => navigation.navigate('Leaderboard')} />
      </Card>

      <Text style={type.heading}>Recent adventures</Text>
      {recent.length === 0 ? (
        <Text style={type.small}>Quests you finish will show up here.</Text>
      ) : (
        <Card style={{ gap: 12 }}>
          {recent.map((c) => (
            <View key={c.questId + c.completedAt} style={styles.history}>
              <MaterialCommunityIcons name="map-marker-check-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong} numberOfLines={1}>
                  {c.questTitle}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {c.landmarkName} · {formatDate(c.completedAt)}
                  {c.partySize > 1 ? ` · party of ${c.partySize}` : ''}
                </Text>
              </View>
              <Text style={type.bodyStrong}>+{c.xp}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScreenShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { type } = useTheme();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={type.heading}>{value}</Text>
      <Text style={type.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  history: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
