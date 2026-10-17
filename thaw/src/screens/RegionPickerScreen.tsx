import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { DEMO_REGIONS } from '../data/regions';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';

export function RegionPickerScreen({ navigation }: RootScreenProps<'RegionPicker'>) {
  const regionId = useGameStore((s) => s.regionId);
  const mode = useGameStore((s) => s.locationMode);
  const permission = useGameStore((s) => s.permission);
  const { setRegion, enableGps, finishOnboarding } = useGameStore.getState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (id: string) => {
    finishOnboarding();
    void setRegion(id);
    navigation.goBack();
  };

  const gps = async () => {
    setBusy(true);
    setError(null);
    finishOnboarding();
    const res = await enableGps();
    setBusy(false);
    if (res.ok) navigation.goBack();
    else setError(`${res.reason ?? 'Location unavailable.'} Pick a sample city below instead.`);
  };

  return (
    <ScreenShell title="Where to explore?" subtitle="Real location, or a sample city anywhere on Earth" back>
      <Card tint={colors.grassSoft} style={{ gap: spacing.sm }}>
        <Text style={type.heading}>Play where you are</Text>
        <Text style={type.small}>Thaw finds public parks, libraries, squares and art near you via OpenStreetMap. Approximate location, only while the app is open.</Text>
        <Button label={mode === 'gps' ? 'Using my location · refresh' : 'Use my location'} icon="crosshairs-gps" onPress={() => void gps()} loading={busy} />
        {permission === 'denied' && <Notice tone="warn" text="Location permission is off. You can enable it in your device settings, or keep playing in a sample city." />}
        {error && <Notice tone="warn" text={error} />}
      </Card>

      <Text style={type.heading}>Sample cities</Text>
      <View style={{ gap: spacing.sm }}>
        {DEMO_REGIONS.map((r) => {
          const on = mode === 'region' && regionId === r.id;
          return (
            <Pressable key={r.id} onPress={() => pick(r.id)} style={({ pressed }) => [styles.region, on && styles.regionOn, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${r.name}, ${r.country}`}>
              <Text style={styles.emoji}>{r.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.subheading}>{r.name}</Text>
                <Text style={type.small}>{r.country}</Text>
              </View>
              {on && <MaterialCommunityIcons name="check-circle" size={24} color={colors.forest} />}
            </Pressable>
          );
        })}
      </View>
      <Notice icon="gesture-tap-hold" text="Tip: long-press anywhere on the map to explore from that point – useful for small towns or places with few mapped landmarks." />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  region: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    minHeight: 64,
  },
  regionOn: { backgroundColor: colors.butterSoft },
  emoji: { fontSize: 28, fontFamily: fonts.body },
});
