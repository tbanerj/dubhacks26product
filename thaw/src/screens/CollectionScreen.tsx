import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, Text, type DimensionValue } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Button } from '../components/Button';
import { EmptyState, ProgressBar } from '../components/Paper';
import { PinArt } from '../components/PinArt';
import { useTheme } from '../theme/useTheme';
import { RARITY_STYLE, THEME_STYLE } from '../theme/palette';
import { collectibleIdFor } from '../game/progression';
import { formatDate } from '../utils/format';
import { t } from '../i18n/strings';
import type { CollectibleTheme, Rarity } from '../types';

interface Slot {
  id: string;
  name: string;
  theme: CollectibleTheme;
  rarity: Rarity;
  landmarkName: string;
  landmarkId: string | null;
  questId: string | null;
  questTitle: string | null;
  unlockedAt: string | null;
}

type Scope = 'earned' | 'nearby';

export function CollectionScreen({ navigation }: TabScreenProps<'Collection'>) {
  const { colors, type, radii } = useTheme();
  const { width } = useWindowDimensions();
  const owned = useGameStore((s) => s.progress.collectibles);
  const completions = useGameStore((s) => s.progress.completions);
  const quests = useGameStore((s) => s.quests);
  const landmarks = useGameStore((s) => s.landmarks);
  const markSeen = useGameStore((s) => s.markCollectiblesSeen);
  const [scope, setScope] = useState<Scope>('earned');
  const [theme, setTheme] = useState<CollectibleTheme | 'all'>('all');
  const [open, setOpen] = useState<Slot | null>(null);

  useFocusEffect(
    useCallback(() => {
      markSeen();
    }, [markSeen]),
  );

  const slots = useMemo(() => {
    const ownedIds = new Set(owned.map((c) => c.id));
    const lmName = new Map(landmarks.map((l) => [l.id, l.name]));
    const byPin = new Map(completions.filter((c) => c.collectibleId).map((c) => [c.collectibleId as string, c]));
    const unlocked: Slot[] = owned.map((c) => {
      const done = byPin.get(c.id);
      return { ...c, landmarkId: done?.landmarkId ?? null, questId: done?.questId ?? null, questTitle: done?.questTitle ?? null };
    });
    const lockedMap = new Map<string, Slot>();
    for (const q of quests) {
      const id = collectibleIdFor(q);
      if (ownedIds.has(id) || lockedMap.has(id)) continue;
      lockedMap.set(id, {
        id,
        name: q.collectible.name,
        theme: q.collectible.theme,
        rarity: q.collectible.rarity,
        landmarkName: lmName.get(q.landmarkId) ?? '',
        landmarkId: q.landmarkId,
        questId: q.id,
        questTitle: q.title,
        unlockedAt: null,
      });
    }
    return { unlocked, locked: [...lockedMap.values()] };
  }, [owned, quests, landmarks, completions]);

  const pool = scope === 'earned' ? slots.unlocked : slots.locked;
  const visible = theme === 'all' ? pool : pool.filter((s) => s.theme === theme);
  const total = slots.unlocked.length + slots.locked.length;
  const tileWidth = width >= 700 ? '31%' : '47%';

  return (
    <ScreenShell title={t('collection.title')} subtitle={`${slots.unlocked.length} of ${Math.max(total, slots.unlocked.length)} discovered`} tab>
      <ProgressBar fraction={total ? slots.unlocked.length / total : 0} label="Collection progress" />
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="tablist">
        <Seg label="Earned" on={scope === 'earned'} onPress={() => setScope('earned')} />
        <Seg label="Nearby" on={scope === 'nearby'} onPress={() => setScope('nearby')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <ThemeChip label="All" on={theme === 'all'} onPress={() => setTheme('all')} />
        {(Object.keys(THEME_STYLE) as CollectibleTheme[]).map((th) => (
          <ThemeChip key={th} label={THEME_STYLE[th].label} on={theme === th} onPress={() => setTheme(th)} />
        ))}
      </ScrollView>

      {visible.length === 0 ? (
        <EmptyState icon="pin-outline" title={scope === 'earned' ? t('collection.empty') : 'Nothing undiscovered nearby.'} body={scope === 'nearby' ? 'New places show up as you explore.' : undefined} />
      ) : (
        <View style={styles.grid}>
          {visible.map((slot) => (
            <PinTile key={slot.id} slot={slot} width={tileWidth} onPress={() => setOpen(slot)} />
          ))}
        </View>
      )}

      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(null)} accessibilityLabel="Dismiss pin details">
          {open && (
            <Pressable onPress={() => undefined} style={[styles.sheet, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
              <View style={styles.handle} />
              <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
              <PinArt theme={open.theme} rarity={open.rarity} size={140} locked={!open.unlockedAt} />
              <Text style={[type.title, { textAlign: 'center' }]}>{open.name}</Text>
              <Text style={type.small}>
                {RARITY_STYLE[open.rarity].label} · {THEME_STYLE[open.theme].label}
              </Text>
              <Text style={[type.body, { textAlign: 'center' }]}>
                {open.unlockedAt
                  ? `Earned ${open.landmarkName ? `at ${open.landmarkName} ` : ''}on ${formatDate(open.unlockedAt)}.`
                  : `Complete ${open.questTitle ?? 'a quest'}${open.landmarkName ? ` at ${open.landmarkName}` : ''} to unlock.`}
              </Text>
              {open.landmarkId ? (
                <Button
                  label="View place"
                  variant="secondary"
                  onPress={() => {
                    const id = open.landmarkId!;
                    setOpen(null);
                    navigation.navigate('Explore', { focusLandmarkId: id });
                  }}
                  style={{ alignSelf: 'stretch' }}
                />
              ) : null}
              {open.questId ? (
                <Button
                  label="View quest"
                  onPress={() => {
                    const id = open.questId!;
                    setOpen(null);
                    navigation.navigate('QuestDetail', { questId: id });
                  }}
                  style={{ alignSelf: 'stretch' }}
                />
              ) : null}
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

function Seg({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors, type, radii } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.seg, { borderRadius: radii.pill, backgroundColor: on ? colors.primary : 'transparent' }]}>
      <Text style={[type.bodyStrong, { color: on ? colors.onPrimary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function ThemeChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors, type, radii } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.theme, { borderRadius: radii.pill, backgroundColor: on ? colors.sageSoft : colors.surface, borderColor: colors.border }]}>
      <Text style={[type.tiny, { color: on ? colors.primary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function PinTile({ slot, onPress, width }: { slot: Slot; onPress: () => void; width: DimensionValue }) {
  const { colors, type, radii } = useTheme();
  const locked = !slot.unlockedAt;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={locked ? `Undiscovered, ${slot.name}, ${slot.landmarkName}` : `${slot.name}, ${RARITY_STYLE[slot.rarity].label}, from ${slot.landmarkName}`}
    >
      <View style={{ opacity: locked ? 0.45 : 1 }}>
        <PinArt theme={slot.theme} rarity={slot.rarity} size={72} locked={locked} />
      </View>
      {locked ? (
        <View style={[styles.lock, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="lock" size={12} color={colors.textSecondary} />
        </View>
      ) : null}
      <Text style={[type.small, { color: colors.text, textAlign: 'center' }]} numberOfLines={2}>
        {slot.name}
      </Text>
      <Text style={[type.tiny, { textAlign: 'center' }]} numberOfLines={1}>
        {RARITY_STYLE[slot.rarity].label}
        {slot.landmarkName ? ` · ${slot.landmarkName}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4 },
  seg: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  theme: { minHeight: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, alignItems: 'center', padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 4, minHeight: 150 },
  lock: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(18,24,21,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, gap: 8, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E4E2D8', marginBottom: 8 },
  close: { position: 'absolute', top: 12, right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
