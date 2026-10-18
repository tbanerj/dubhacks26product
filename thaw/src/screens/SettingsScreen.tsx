import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore, type AppearancePreference } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { AppSwitch, Card, Chip, SectionTitle, SettingsRow } from '../components/Paper';
import { Button } from '../components/Button';
import { useTheme } from '../theme/useTheme';
import { integrationStatus } from '../config/env';
import { t } from '../i18n/strings';

const APPEARANCES: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const { colors, type, radii } = useTheme();
  const settings = useGameStore((s) => s.settings);
  const account = useGameStore((s) => s.account);
  const playerName = useGameStore((s) => s.player.name);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const setDemoMode = useGameStore((s) => s.setDemoMode);
  const signOut = useGameStore((s) => s.signOut);
  const deleteAccount = useGameStore((s) => s.deleteAccount);
  const resetDemo = useGameStore((s) => s.resetDemo);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const integrations = integrationStatus();

  const reset = () => {
    const go = async () => {
      setResetting(true);
      await resetDemo();
      setResetting(false);
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(t('profile.reset'), t('profile.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <ScreenShell title="Settings" back>
      <Text style={type.tiny}>EXPLORATION</Text>
      <Card style={{ paddingVertical: 4 }}>
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
          control={<AppSwitch value={settings.preferSolo} onValueChange={(v) => updateSettings({ preferSolo: v })} accessibilityLabel="Prefer solo quests" />}
        />
        <SettingsRow
          icon="timer-outline"
          label="Shorter walks"
          hint="Suggest shorter, lower-mobility quests"
          control={<AppSwitch value={settings.mobilityFriendly} onValueChange={(v) => updateSettings({ mobilityFriendly: v })} accessibilityLabel="Shorter walks" />}
        />
      </Card>

      <Text style={type.tiny}>ACCOUNT</Text>
      <Card style={{ gap: 12 }}>
        <Text style={type.bodyStrong}>{account?.email ?? 'Signed in'}</Text>
        <SettingsRow icon="account-edit-outline" label="Profile" hint={playerName} onPress={() => navigation.navigate('EditAvatar')} />
        <Integration name="Supabase" status={integrations.supabase} demo="Accounts are not configured" />
        <Integration name="Gemini" status={integrations.gemini} demo="Built-in quests and simulated photo checks" />
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

      <Text style={type.tiny}>PREFERENCES</Text>
      <Card style={{ gap: 10 }}>
        <Text style={type.bodyStrong}>Appearance</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="radiogroup">
          {APPEARANCES.map((item) => {
            const on = settings.appearance === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => updateSettings({ appearance: item.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.seg, { backgroundColor: on ? colors.primary : 'transparent', borderRadius: radii.pill }]}
              >
                <Text style={[type.bodyStrong, { color: on ? colors.onPrimary : colors.textSecondary }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <SettingsRow
          icon="flask-outline"
          label="Demo mode"
          hint="Stand in for GPS with Seattle. Quests, parties, photos, and your account stay real."
          control={<AppSwitch value={settings.demoMode} onValueChange={(v) => void setDemoMode(v)} accessibilityLabel="Demo mode" />}
        />
      </Card>

      {__DEV__ && settings.demoMode && (
        <>
          <SectionTitle>Development</SectionTitle>
          <Card style={{ gap: 12 }}>
            <Integration name="Gemini quest writer" status={integrations.gemini} demo="Built-in quest templates" />
            <Integration name="Gemini photo check" status={integrations.gemini} demo="Simulated verification" />
            <Integration name="Photon invite relay" status={integrations.photon} demo="Local simulated lobby" />
            <Integration name="OpenStreetMap places" status="live" demo="" note="Used with location. Sample regions use saved places." />
            <Button label={t('profile.reset')} variant="danger" onPress={reset} loading={resetting} />
          </Card>
        </>
      )}
    </ScreenShell>
  );
}

function Integration({ name, status, demo, note }: { name: string; status: 'live' | 'demo'; demo: string; note?: string }) {
  const { type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{name}</Text>
        <Text style={type.small}>{note ?? (status === 'live' ? 'Configured' : `Not configured. ${demo}`)}</Text>
      </View>
      <Chip label={status === 'live' ? 'Live' : 'Demo'} />
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
