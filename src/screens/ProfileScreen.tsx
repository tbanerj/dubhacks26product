import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, ProgressBar, SectionTitle } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { hueColor } from '../theme/palette';
import { currentStreak, dailyXp, levelProgress } from '../game/progression';
import { formatDate, formatNumber } from '../utils/format';
import { integrationStatus } from '../config/env';
import { t } from '../i18n/strings';

const HUES = [28, 48, 95, 150, 200, 330];

export function ProfileScreen(_props: TabScreenProps<'Profile'>) {
  const s = useGameStore(useShallow((st) => ({ player: st.player, progress: st.progress, settings: st.settings })));
  const a = useGameStore(useShallow((st) => ({ setPlayerName: st.setPlayerName, setAvatarHue: st.setAvatarHue, updateSettings: st.updateSettings, resetDemo: st.resetDemo })));
  const [name, setName] = useState(s.player.name);
  const [resetting, setResetting] = useState(false);
  const lp = levelProgress(s.progress.totalXp);
  const streak = currentStreak(s.progress);
  const integrations = integrationStatus();

  const reset = () => {
    const go = async () => {
      setResetting(true);
      await a.resetDemo();
      setName(useGameStore.getState().player.name);
      setResetting(false);
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(t('profile.reset'), t('profile.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <ScreenShell title={s.player.name} subtitle={t('profile.level', { level: lp.level })} tab keyboardShouldPersistTaps="handled">
      <Card tint={colors.white} style={{ alignItems: 'center', gap: spacing.sm }}>
        <View style={styles.avatar}>
          <Critter hue={s.player.avatarHue} size={110} />
        </View>
        <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Avatar colour">
          {HUES.map((h) => (
            <Pressable
              key={h}
              onPress={() => a.setAvatarHue(h)}
              style={[styles.swatch, { backgroundColor: hueColor(h) }, s.player.avatarHue === h && styles.swatchOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: s.player.avatarHue === h }}
              accessibilityLabel={`Colour ${h}`}
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
        {s.progress.completions.slice(0, 8).map((c) => (
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
        ))}
      </Card>

      <SectionTitle>Settings</SectionTitle>
      <Card tint={colors.white} style={{ gap: spacing.xs }}>
        <Toggle label="Imperial units (ft, mi)" value={s.settings.units === 'imperial'} onChange={(v) => a.updateSettings({ units: v ? 'imperial' : 'metric' })} />
        <Toggle label="Prefer solo quests" hint="Hide social and party quests" value={s.settings.preferSolo} onChange={(v) => a.updateSettings({ preferSolo: v })} />
        <Toggle label="Low-mobility quests" hint="Shorter quests, less walking" value={s.settings.mobilityFriendly} onChange={(v) => a.updateSettings({ mobilityFriendly: v })} />
        <Toggle label="Demo helpers" hint="Simulated walking & verification outcomes" value={s.settings.demoMode} onChange={(v) => a.updateSettings({ demoMode: v })} />
      </Card>

      <SectionTitle>Integrations</SectionTitle>
      <Card tint={colors.paper} style={{ gap: spacing.sm }}>
        <Integration name="Gemini quest writer" status={integrations.gemini} demo="Built-in quest templates" />
        <Integration name="Perceptron photo check" status={integrations.perceptron} demo="Simulated verification" />
        <Integration name="Photon invite relay" status={integrations.photon} demo="Local simulated lobby + share sheet" />
        <Integration name="OpenStreetMap places" status="live" demo="" note="Used with “Use my location”; sample regions use saved demo places." />
      </Card>

      <Button label={t('profile.reset')} icon="refresh" variant="danger" onPress={reset} loading={resetting} />
      <Text style={[type.small, { textAlign: 'center' }]}>
        {t('appName')} · {t('tagline')}
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

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{label}</Text>
        {hint && <Text style={type.small}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.grass, false: colors.paperEdge }} thumbColor={value ? colors.forest : colors.white} accessibilityLabel={label} />
    </View>
  );
}

function Integration({ name, status, demo, note }: { name: string; status: 'live' | 'demo'; demo: string; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{name}</Text>
        <Text style={type.small}>{note ?? (status === 'live' ? 'Configured' : `Not configured – ${demo}`)}</Text>
      </View>
      <Chip label={status === 'live' ? 'Live' : 'Demo'} bg={status === 'live' ? colors.grass : colors.butterSoft} />
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
});
