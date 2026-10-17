import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore, type AppearancePreference } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, SectionTitle, SettingsRow } from '../components/Paper';
import { Button } from '../components/Button';
import { useTheme } from '../theme/useTheme';
import { integrationStatus } from '../config/env';
import { t } from '../i18n/strings';

const APPEARANCES: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function SettingsScreen(_props: RootScreenProps<'Settings'>) {
  const { colors, type, radii } = useTheme();
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const resetDemo = useGameStore((s) => s.resetDemo);
  const [resetting, setResetting] = useState(false);
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
            <Switch
              value={settings.units === 'imperial'}
              onValueChange={(v) => updateSettings({ units: v ? 'imperial' : 'metric' })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="Imperial units"
            />
          }
        />
        <SettingsRow
          icon="walk"
          label="Prefer solo"
          hint="New quests default to solo"
          control={<Switch value={settings.preferSolo} onValueChange={(v) => updateSettings({ preferSolo: v })} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.surface} accessibilityLabel="Prefer solo quests" />}
        />
        <SettingsRow
          icon="timer-outline"
          label="Shorter walks"
          hint="Suggest shorter, lower-mobility quests"
          control={<Switch value={settings.mobilityFriendly} onValueChange={(v) => updateSettings({ mobilityFriendly: v })} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.surface} accessibilityLabel="Shorter walks" />}
        />
      </Card>

      <Text style={type.tiny}>PREFERENCES</Text>
      <Card style={{ gap: 10 }}>
        <Text style={type.bodyStrong}>Appearance</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="radiogroup">
          {APPEARANCES.map((item) => {
            const on = settings.appearance === item.id;
            return (
              <Text
                key={item.id}
                onPress={() => updateSettings({ appearance: item.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.seg, type.bodyStrong, { color: on ? colors.onPrimary : colors.textSecondary, backgroundColor: on ? colors.primary : 'transparent', borderRadius: radii.pill }]}
              >
                {item.label}
              </Text>
            );
          })}
        </View>
      </Card>

      {__DEV__ && (
        <>
          <SectionTitle>Development</SectionTitle>
          <Card style={{ gap: 12 }}>
            <SettingsRow
              icon="flask-outline"
              label="Demo helpers"
              hint="Simulated walking and verification outcomes"
              control={<Switch value={settings.demoMode} onValueChange={(v) => updateSettings({ demoMode: v })} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.surface} accessibilityLabel="Demo helpers" />}
            />
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
  seg: { flex: 1, textAlign: 'center', paddingVertical: 10, overflow: 'hidden', minHeight: 40 },
});
