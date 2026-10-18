import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore, type AppearancePreference } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { AppSwitch, Card, ProgressBar, SettingsRow } from '../components/Paper';
import { Button, IconButton } from '../components/Button';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { regionById } from '../data/regions';
import { currentStreak, dailyXp, levelProgress } from '../game/progression';
import { formatDate, formatNumber } from '../utils/format';
import { t } from '../i18n/strings';

export function YouScreen({ navigation }: TabScreenProps<'You'>) {
  const { colors, type, radii } = useTheme();
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
  const updateSettings = useGameStore((st) => st.updateSettings);
  const settings = useGameStore((st) => st.settings);
  const signOut = useGameStore((st) => st.signOut);
  const deleteAccount = useGameStore((st) => st.deleteAccount);
  const [deleting, setDeleting] = useState(false);
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
            <AppSwitch value={s.demoMode} onValueChange={(v) => void setDemoMode(v)} accessibilityLabel="Demo mode" />
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

      <Card style={styles.linkCard}>
        <SettingsRow icon="book-outline" label="Collection" onPress={() => navigation.navigate('Collection')} />
        <SettingsRow icon="trophy-outline" label="Leaderboards" onPress={() => navigation.navigate('Leaderboard')} />
      </Card>

      <Text style={type.tiny}>SETTINGS</Text>
      <Card style={{ gap: 12 }}>
        <Text style={type.bodyStrong}>Appearance</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="radiogroup">
          {(['system', 'light', 'dark'] as AppearancePreference[]).map((id) => {
            const on = (settings.appearance ?? 'system') === id;
            const label = id === 'system' ? 'System' : id === 'light' ? 'Light' : 'Dark';
            return (
              <Pressable
                key={id}
                onPress={() => updateSettings({ appearance: id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.seg, { backgroundColor: on ? colors.primary : 'transparent', borderRadius: radii.pill }]}
              >
                <Text style={[type.bodyStrong, { color: on ? colors.onPrimary : colors.textSecondary }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <SettingsRow
          icon="ruler"
          label="Units"
          value={settings.units === 'imperial' ? 'Imperial' : 'Metric'}
          control={
            <AppSwitch
              value={settings.units === 'imperial'}
              onValueChange={(v) => updateSettings({ units: v ? 'imperial' : 'metric' })}
              accessibilityLabel="Imperial units"
            />
          }
        />
        <SettingsRow
          icon="walk"
          label="Prefer solo"
          hint="New quests default to solo"
          control={
            <AppSwitch value={settings.preferSolo} onValueChange={(v) => updateSettings({ preferSolo: v })} accessibilityLabel="Prefer solo quests" />
          }
        />
        <SettingsRow
          icon="timer-outline"
          label="Shorter walks"
          hint="Suggest shorter, lower-mobility quests"
          control={
            <AppSwitch value={settings.mobilityFriendly} onValueChange={(v) => updateSettings({ mobilityFriendly: v })} accessibilityLabel="Shorter walks" />
          }
        />
        <SettingsRow icon="account-edit-outline" label="Profile" hint={s.player.name} onPress={() => navigation.navigate('EditAvatar')} />
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        <Button
          label="Delete account"
          variant="danger"
          loading={deleting}
          onPress={() => {
            const go = async () => {
              setDeleting(true);
              const res = await deleteAccount();
              setDeleting(false);
              if (!res.ok) console.warn('delete-account', res.error ?? 'Delete failed.');
            };
            if (Platform.OS === 'web') return void go();
            Alert.alert('Delete account?', 'This removes your explorer, XP, pins, and parties. It cannot be undone.', [
              { text: t('common.cancel'), style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => void go() },
            ]);
          }}
        />
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
  linkCard: { paddingVertical: 4, paddingLeft: 14, paddingRight: 8 },
  segment: { flexDirection: 'row', padding: 4 },
  seg: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
