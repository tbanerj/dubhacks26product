import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { hueColor } from '../theme/palette';

const HUES = [28, 48, 95, 150, 200, 330];

export function EditAvatarScreen({ navigation }: RootScreenProps<'EditAvatar'>) {
  const { colors, type, radii } = useTheme();
  const player = useGameStore((s) => s.player);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setAvatarHue = useGameStore((s) => s.setAvatarHue);
  const [name, setName] = useState(player.name);
  const [hue, setHue] = useState(player.avatarHue);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const clean = name.replace(/[\u0000-\u001F]/g, '').trim();
    if (!clean) {
      setError('Add a name to save.');
      return;
    }
    setPlayerName(clean);
    setAvatarHue(hue);
    navigation.goBack();
  };

  return (
    <ScreenShell title="Make it yours" subtitle="Choose a sprout color and a name." back>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View style={[styles.avatar, { backgroundColor: colors.sageSoft }]}>
          <Critter hue={hue} size={140} />
        </View>
        <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Sprout color">
          {HUES.map((h) => {
            const selected = hue === h;
            return (
              <Pressable
                key={h}
                onPress={() => setHue(h)}
                style={[styles.swatch, { backgroundColor: hueColor(h) }, selected && { borderColor: colors.text }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={selected ? `Color ${h}, selected` : `Color ${h}`}
              >
                {selected ? <MaterialCommunityIcons name="check" size={16} color={colors.text} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={type.small}>Explorer name</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (error) setError(null);
        }}
        maxLength={24}
        style={[styles.input, type.body, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.lg }]}
        accessibilityLabel="Explorer name"
        placeholder="Explorer name"
        placeholderTextColor={colors.textFaint}
      />
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : null}
      <Button label="Save changes" onPress={save} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
});
