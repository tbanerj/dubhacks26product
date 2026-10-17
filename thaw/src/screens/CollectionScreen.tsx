import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, EmptyState, ProgressBar } from '../components/Paper';
import { PinArt } from '../components/PinArt';
import { Button } from '../components/Button';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
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
  unlockedAt: string | null;
}

export function CollectionScreen({ navigation }: TabScreenProps<'Collection'>) {
  const owned = useGameStore((s) => s.progress.collectibles);
  const quests = useGameStore((s) => s.quests);
  const landmarks = useGameStore((s) => s.landmarks);
  const [open, setOpen] = useState<Slot | null>(null);

  const slots = useMemo(() => {
    const ownedIds = new Set(owned.map((c) => c.id));
    const lmName = new Map(landmarks.map((l) => [l.id, l.name]));
    const unlocked: Slot[] = owned.map((c) => ({ ...c, landmarkId: null }));
    const lockedMap = new Map<string, Slot>();
    for (const q of quests) {
      const id = collectibleIdFor(q);
      if (ownedIds.has(id) || lockedMap.has(id)) continue;
      lockedMap.set(id, { id, name: q.collectible.name, theme: q.collectible.theme, rarity: q.collectible.rarity, landmarkName: lmName.get(q.landmarkId) ?? '', landmarkId: q.landmarkId, unlockedAt: null });
    }
    return { unlocked, locked: [...lockedMap.values()] };
  }, [owned, quests, landmarks]);

  const total = slots.unlocked.length + slots.locked.length;
  const byTheme = useMemo(() => {
    const m = new Map<CollectibleTheme, number>();
    owned.forEach((c) => m.set(c.theme, (m.get(c.theme) ?? 0) + 1));
    return m;
  }, [owned]);

  return (
    <ScreenShell title={t('collection.title')} subtitle="Souvenirs from places you’ve shown up" tab>
      <Card tint={colors.butterSoft} style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={type.heading}>
            {slots.unlocked.length} / {total} pins
          </Text>
          <Text style={type.small}>in this area + earned</Text>
        </View>
        <ProgressBar fraction={total ? slots.unlocked.length / total : 0} color={colors.sunset} label="Collection progress" />
        <View style={styles.themes}>
          {(Object.keys(THEME_STYLE) as CollectibleTheme[]).map((th) => (
            <View key={th} style={[styles.themeChip, { backgroundColor: THEME_STYLE[th].base }]}>
              <Text style={styles.themeText}>
                {THEME_STYLE[th].label} · {byTheme.get(th) ?? 0}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {slots.unlocked.length === 0 ? (
        <EmptyState icon="pin-outline" title={t('collection.empty')} />
      ) : (
        <View style={styles.grid}>
          {slots.unlocked.map((s) => (
            <PinTile key={s.id} slot={s} onPress={() => setOpen(s)} />
          ))}
        </View>
      )}

      {slots.locked.length > 0 && (
        <>
          <Text style={type.heading}>Still to find nearby</Text>
          <View style={styles.grid}>
            {slots.locked.map((s) => (
              <PinTile key={s.id} slot={s} onPress={() => setOpen(s)} />
            ))}
          </View>
        </>
      )}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(null)} accessibilityLabel="Close pin details">
          {open && (
            <Pressable onPress={() => undefined} style={{ width: '100%' }}>
              <Card tint={open.unlockedAt ? THEME_STYLE[open.theme].base : colors.paper} style={{ alignItems: 'center', gap: spacing.sm }}>
                <PinArt theme={open.theme} rarity={open.rarity} size={140} locked={!open.unlockedAt} />
                <Text style={[type.title, { textAlign: 'center' }]}>{open.unlockedAt ? open.name : '???'}</Text>
                <Text style={type.small}>
                  {RARITY_STYLE[open.rarity].label} · {THEME_STYLE[open.theme].label}
                </Text>
                <Text style={[type.body, { textAlign: 'center' }]}>
                  {open.unlockedAt ? `Earned at ${open.landmarkName} on ${formatDate(open.unlockedAt)}.` : `Complete a quest at ${open.landmarkName} to unlock.`}
                </Text>
                {!open.unlockedAt && open.landmarkId && (
                  <Button
                    label="Show on map"
                    icon="map-marker-radius"
                    onPress={() => {
                      const id = open.landmarkId!;
                      setOpen(null);
                      navigation.navigate('Explore', { focusLandmarkId: id });
                    }}
                    style={{ alignSelf: 'stretch' }}
                  />
                )}
                <Button label="Close" variant="ghost" compact onPress={() => setOpen(null)} />
              </Card>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

function PinTile({ slot, onPress }: { slot: Slot; onPress: () => void }) {
  const locked = !slot.unlockedAt;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, locked && styles.tileLocked, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={locked ? `Locked pin at ${slot.landmarkName}` : `${slot.name}, ${RARITY_STYLE[slot.rarity].label}, from ${slot.landmarkName}`}
    >
      <PinArt theme={slot.theme} rarity={slot.rarity} size={72} locked={locked} />
      <Text style={styles.tileName} numberOfLines={2}>
        {locked ? t('collection.locked') : slot.name}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {slot.landmarkName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  themeChip: { borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3 },
  themeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '33%',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    gap: 2,
  },
  tileLocked: { backgroundColor: colors.paperDeep, borderStyle: 'dashed', borderBottomWidth: 2 },
  tileName: { fontFamily: fonts.display, fontSize: 13, color: colors.ink, textAlign: 'center' },
  tileSub: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.inkSoft },
  scrim: { flex: 1, backgroundColor: 'rgba(48,55,45,0.5)', justifyContent: 'center', padding: spacing.lg },
});
