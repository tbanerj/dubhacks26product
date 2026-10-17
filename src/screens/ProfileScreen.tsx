import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, Notice, ProgressBar, SectionTitle } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { hueColor } from '../theme/palette';
import { currentStreak, dailyXp, levelProgress } from '../game/progression';
import { formatDate, formatNumber } from '../utils/format';
import { t } from '../i18n/strings';

const HUES = [28, 48, 95, 150, 200, 330];

function confirmAction(title: string, body: string, action: string, onYes: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: action, style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}

export function ProfileScreen(_props: TabScreenProps<'Profile'>) {
  const s = useGameStore(
    useShallow((st) => ({
      player: st.player,
      progress: st.progress,
      settings: st.settings,
      account: st.account,
      syncState: st.syncState,
    })),
  );
  const a = useGameStore(
    useShallow((st) => ({
      setPlayerName: st.setPlayerName,
      setAvatarHue: st.setAvatarHue,
      updateSettings: st.updateSettings,
      setDemoMode: st.setDemoMode,
      resetDemoSandbox: st.resetDemoSandbox,
      signOut: st.signOut,
      deleteAccount: st.deleteAccount,
      pullCloud: st.pullCloud,
    })),
  );
  const [name, setName] = useState(s.player.name);
  // Keep the name field in step when the name changes elsewhere (cloud sync).
  const [lastName, setLastName] = useState(s.player.name);
  if (s.player.name !== lastName) {
    setLastName(s.player.name);
    setName(s.player.name);
  }
  const [busy, setBusy] = useState<'signout' | 'delete' | 'demo' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lp = levelProgress(s.progress.totalXp);
  const streak = currentStreak(s.progress);
  const demo = s.settings.demoMode;

  const toggleDemo = (on: boolean) => {
    const go = async () => {
      setBusy('demo');
      await a.setDemoMode(on);
      setBusy(null);
    };
    if (on) {
      confirmAction(
        'Turn on Demo mode?',
        'Demo mode is a practice sandbox: sample cities, simulated walking and photo checks, and demo explorers. Nothing you earn there counts toward your account or the global leaderboard.',
        'Turn on',
        () => void go(),
        false,
      );
    } else void go();
  };

  const doSignOut = () =>
    confirmAction(
      'Log out?',
      'You can log back in any time – your progress is saved to your account.',
      'Log out',
      () => {
        setBusy('signout');
        void a.signOut().finally(() => setBusy(null));
      },
      false,
    );

  const doDelete = () =>
    confirmAction('Delete your account?', 'This permanently deletes your account, XP, pins, parties and leaderboard history. This can’t be undone.', 'Delete forever', () =>
      void (async () => {
        setBusy('delete');
        setError(null);
        const res = await a.deleteAccount();
        setBusy(null);
        if (!res.ok) setError(res.error ?? 'Couldn’t delete your account.');
      })(),
    );

  return (
    <ScreenShell title={s.player.name} subtitle={demo ? `Demo sandbox · ${t('profile.level', { level: lp.level })}` : t('profile.level', { level: lp.level })} tab keyboardShouldPersistTaps="handled">
      {demo && <Notice tone="demo" icon="flask-outline" text="Demo mode is on. XP, pins and quests here are a practice sandbox and don’t count toward your account." />}

      <Card tint={colors.white} style={{ alignItems: 'center', gap: spacing.sm }}>
        <View style={styles.avatar}>
          <Critter hue={s.player.avatarHue} size={110} />
        </View>
        <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Avatar colour">
          {HUES.map((h, i) => (
            <Pressable
              key={h}
              onPress={() => a.setAvatarHue(h)}
              style={[styles.swatch, { backgroundColor: hueColor(h) }, s.player.avatarHue === h && styles.swatchOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: s.player.avatarHue === h }}
              accessibilityLabel={`Avatar colour ${i + 1}`}
            />
          ))}
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => a.setPlayerName(name)}
          onBlur={() => a.setPlayerName(name)}
          maxLength={24}
          style={styles.nameInput}
          accessibilityLabel="Explorer name"
          placeholder="Explorer name"
          placeholderTextColor={colors.inkFaint}
        />
        <View style={{ alignSelf: 'stretch', gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.subheading}>{t('profile.level', { level: lp.level })}</Text>
            <Text style={type.small}>
              {formatNumber(lp.intoLevel)} / {formatNumber(lp.levelSpan)} XP
            </Text>
          </View>
          <ProgressBar fraction={lp.fraction} label="Level progress" />
        </View>
      </Card>

      <View style={styles.stats}>
        <Stat icon="fire" label="Streak" value={streak > 0 ? t('profile.streak', { n: streak }) : 'Start today'} tint={colors.sunsetSoft} />
        <Stat icon="lightning-bolt-outline" label="Today" value={`${formatNumber(dailyXp(s.progress))} XP`} tint={colors.butterSoft} />
        <Stat icon="flag-checkered" label="Quests" value={formatNumber(s.progress.completions.length)} tint={colors.grassSoft} />
        <Stat icon="map-marker-check-outline" label="Places" value={formatNumber(s.progress.visitedLandmarkIds.length)} tint={colors.skySoft} />
      </View>

      <SectionTitle>Discovered places</SectionTitle>
      <Card tint={colors.paper} style={{ gap: spacing.sm }}>
        {s.progress.completions.length === 0 ? (
          <Text style={type.small}>Nothing yet – your first quest is waiting on the map.</Text>
        ) : (
          s.progress.completions.slice(0, 8).map((c) => (
            <View key={c.questId + c.completedAt} style={styles.history}>
              <MaterialCommunityIcons name="map-marker-check" size={20} color={colors.forest} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong} numberOfLines={1}>
                  {c.landmarkName}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {c.questTitle} · {formatDate(c.completedAt)}
                  {c.partySize > 1 ? ` · party of ${c.partySize}` : ''}
                </Text>
              </View>
              <Text style={type.bodyStrong}>+{c.xp}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card tint={colors.white} style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <MaterialCommunityIcons name="account-check-outline" size={24} color={colors.forest} />
          <View style={{ flex: 1 }}>
            <Text style={type.bodyStrong} numberOfLines={1}>
              {s.account?.email ?? 'Signed in'}
            </Text>
            <Text style={type.small}>Progress is saved to your account.</Text>
          </View>
          <Pressable onPress={() => void a.pullCloud()} accessibilityRole="button" accessibilityLabel="Refresh from server" hitSlop={8}>
            <Chip
              label={s.syncState === 'synced' ? 'Synced' : s.syncState === 'syncing' ? 'Syncing…' : s.syncState === 'offline' ? 'Offline' : 'Ready'}
              icon={s.syncState === 'synced' ? 'cloud-check-outline' : s.syncState === 'offline' ? 'cloud-off-outline' : 'cloud-sync-outline'}
              bg={s.syncState === 'synced' ? colors.grassSoft : s.syncState === 'offline' ? colors.sunsetSoft : colors.butterSoft}
            />
          </Pressable>
        </View>
        {s.syncState === 'offline' && <Notice tone="warn" icon="cloud-off-outline" text="Offline – showing your last saved progress. Quests need a connection to be verified." />}
        {error && <Notice tone="warn" icon="alert-circle-outline" text={error} />}
        <Button label="Log out" icon="logout" variant="secondary" compact loading={busy === 'signout'} onPress={doSignOut} />
        <Button label="Delete account" icon="account-remove-outline" variant="danger" compact loading={busy === 'delete'} onPress={doDelete} />
      </Card>

      <SectionTitle>Settings</SectionTitle>
      <Card tint={colors.white} style={{ gap: spacing.xs }}>
        <Toggle label="Imperial units (ft, mi)" value={s.settings.units === 'imperial'} onChange={(v) => a.updateSettings({ units: v ? 'imperial' : 'metric' })} />
        <Toggle label="Prefer solo quests" hint="Hide social and party quests" value={s.settings.preferSolo} onChange={(v) => a.updateSettings({ preferSolo: v })} />
        <Toggle label="Low-mobility quests" hint="Shorter quests, less walking" value={s.settings.mobilityFriendly} onChange={(v) => a.updateSettings({ mobilityFriendly: v })} />
        <View style={styles.divider} />
        <Toggle
          label="Demo mode"
          hint="Practice sandbox with sample cities and simulations. Doesn’t count toward your account."
          value={demo}
          disabled={busy === 'demo'}
          onChange={toggleDemo}
        />
        {demo && (
          <Button
            label="Reset demo sandbox"
            icon="refresh"
            variant="secondary"
            compact
            loading={busy === 'reset'}
            onPress={() => {
              setBusy('reset');
              void a.resetDemoSandbox().finally(() => setBusy(null));
            }}
          />
        )}
      </Card>

      <Text style={[type.small, { textAlign: 'center' }]}>
        {t('appName')} · {t('tagline')}
        {'\n'}Map data © OpenStreetMap contributors · Photo checks by Google Gemini
      </Text>
    </ScreenShell>
  );
}

function Stat({ icon, label, value, tint }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string; tint: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: tint }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.ink} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function Toggle({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{label}</Text>
        {hint && <Text style={type.small}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.grass, false: colors.paperEdge }}
        thumbColor={value ? colors.forest : colors.white}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.butterSoft, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.ink },
  swatchOn: { borderWidth: 4, transform: [{ scale: 1.1 }] },
  nameInput: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    borderBottomWidth: 2,
    borderColor: colors.paperEdge,
    paddingVertical: 4,
    minHeight: 44,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { width: '48%', flexGrow: 1, borderRadius: radii.lg, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.ink, padding: spacing.md, gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  history: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  divider: { height: 2, backgroundColor: colors.paperDeep, marginVertical: spacing.xs },
});
