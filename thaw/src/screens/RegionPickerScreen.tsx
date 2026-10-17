import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { DEMO_REGIONS } from '../data/regions';
import { useTheme } from '../theme/useTheme';

export function RegionPickerScreen({ navigation }: RootScreenProps<'RegionPicker'>) {
  const { colors, type, radii } = useTheme();
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
    <ScreenShell title="Where to explore?" subtitle="Real location, or a sample city" back>
      <Card style={{ gap: 8 }}>
        <Text style={type.heading}>Play where you are</Text>
        <Text style={type.small}>Thaw finds public parks, libraries, squares and art near you via OpenStreetMap. Approximate location, only while the app is open.</Text>
        <Button label={mode === 'gps' ? 'Using my location' : 'Use my location'} onPress={() => void gps()} loading={busy} />
        {permission === 'denied' && <Notice tone="warn" text="Location permission is off. You can enable it in your device settings, or keep playing in a sample city." />}
        {error && <Notice tone="warn" text={error} />}
      </Card>

      <Text style={type.heading}>Sample cities</Text>
      <View style={{ gap: 8 }}>
        {DEMO_REGIONS.map((r) => {
          const on = mode === 'region' && regionId === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => pick(r.id)}
              style={({ pressed }) => [styles.region, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.sageSoft : colors.surface, borderRadius: radii.lg, opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${r.name}, ${r.country}${on ? ', selected' : ''}. Sample city.`}
            >
              <Text style={styles.emoji}>{r.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{r.name}</Text>
                <Text style={type.small}>{r.country} · Sample</Text>
              </View>
              {on ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Notice text="Long-press the map to explore from a public point you choose." />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  region: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, minHeight: 64 },
  emoji: { fontSize: 26 },
});
