import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { GameMap } from '../components/map/GameMap';
import { QuestCard, QuestPreview } from '../components/QuestCard';
import { Button, IconButton } from '../components/Button';
import { EmptyState, Notice } from '../components/Paper';
import { BottomSheet } from '../components/BottomSheet';
import { GlassSurface } from '../components/GlassSurface';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { regionById } from '../data/regions';
import { tabBarOffset } from '../navigation/TabBar';
import { t } from '../i18n/strings';
import { watchPosition } from '../services/location';
import { distanceMeters } from '../game/geo';

const SHEET_COLLAPSED = 236;

export function ExploreScreen({ navigation, route }: TabScreenProps<'Explore'>) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { colors, type, spacing } = useTheme();
  const world = useWorld();
  const st = useGameStore(
    useShallow((s) => ({
      hue: s.player.avatarHue,
      units: s.settings.units,
      preferSolo: s.settings.preferSolo,
      mobilityFriendly: s.settings.mobilityFriendly,
      demoMode: s.settings.demoMode,
      worldStatus: s.worldStatus,
      worldNote: s.worldNote,
      locationMode: s.locationMode,
      regionId: s.regionId,
      questSource: s.questSource,
      permission: s.permission,
    })),
  );
  const actions = useGameStore(
    useShallow((s) => ({
      enableGps: s.enableGps,
      setManualCenter: s.setManualCenter,
      clearSimulatedPosition: s.clearSimulatedPosition,
      reloadWorld: s.reloadWorld,
      updateSettings: s.updateSettings,
    })),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [focus, setFocus] = useState<{ coordinate: { latitude: number; longitude: number }; token: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hiddenStatus, setHiddenStatus] = useState<string | null>(null);

  useEffect(() => {
    const s = useGameStore.getState();
    if (s.landmarks.length > 0 && s.quests.length > 0 && s.worldStatus !== 'loading') {
      useGameStore.setState({ worldStatus: 'ready' });
    }
    void s.reloadWorld();
  }, []);

  const lastCoord = useRef(world.position.coordinate);
  useEffect(() => {
    const prev = lastCoord.current;
    const next = world.position.coordinate;
    lastCoord.current = next;
    if (distanceMeters(prev, next) > 350) setFocus({ coordinate: next, token: Date.now() });
  }, [world.position.coordinate]);

  useEffect(() => {
    if (st.locationMode !== 'gps' || st.permission !== 'granted') return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void watchPosition((c) => {
      const prev = useGameStore.getState().gpsPosition;
      useGameStore.setState({ gpsPosition: c });
      const state = useGameStore.getState();
      if (state.locationMode !== 'gps' || state.worldStatus === 'loading' || !prev) return;
      if (distanceMeters(prev, c) < 800) return;
      void state.reloadWorld();
    }).then((unsub) => {
      if (cancelled) unsub();
      else stop = unsub;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [st.locationMode, st.permission]);

  const focusLandmarkId = route.params?.focusLandmarkId;
  const [handledFocus, setHandledFocus] = useState<string | undefined>(undefined);
  if (focusLandmarkId !== handledFocus) {
    setHandledFocus(focusLandmarkId);
    const lm = focusLandmarkId ? world.lmById.get(focusLandmarkId) : undefined;
    if (lm) {
      setSelectedId(lm.id);
      setFocus((prev) => ({ coordinate: lm.coordinate, token: (prev?.token ?? 0) + 1 }));
    }
  }
  useEffect(() => {
    if (focusLandmarkId) navigation.setParams({ focusLandmarkId: undefined });
  }, [focusLandmarkId, navigation]);

  const requestMyLocation = useCallback(async () => {
    setGpsBusy(true);
    setGpsError(null);
    const res = await actions.enableGps();
    setGpsBusy(false);
    if (res.ok) setRecenterToken((n) => n + 1);
    else setGpsError(res.reason ?? 'Location unavailable.');
  }, [actions]);

  const onLongPress = useCallback(
    (c: { latitude: number; longitude: number }) => {
      const go = () => {
        void actions.setManualCenter(c);
        setSelectedId(null);
      };
      if (Platform.OS === 'web') return go();
      Alert.alert('Explore from here?', 'Thaw will look for public places around this point. Only choose public, well-lit areas to meet.', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Explore here', onPress: go },
      ]);
    },
    [actions],
  );

  const selectedEntries = useMemo(() => world.entries.filter((e) => e.landmark.id === selectedId), [world.entries, selectedId]);
  const preview = selectedEntries.find((e) => e.status !== 'completed') ?? selectedEntries[0] ?? world.active ?? world.entries.find((e) => e.status !== 'completed') ?? world.entries[0] ?? null;
  const region = regionById(st.regionId);
  const bar = tabBarOffset(insets.bottom);
  const posLabel = st.demoMode
    ? `Demo · ${region?.name ?? 'Seattle'}`
    : world.position.kind === 'gps'
      ? t('explore.gps')
      : world.position.kind === 'simulated'
        ? t('explore.simulated')
        : world.position.kind === 'manual'
          ? t('explore.manual')
          : `${region?.name ?? 'Sample'} · ${t('explore.sampleLocation')}`;

  const status = dataStatus(st, world.position.kind);
  const visibleStatus = status && status.text !== hiddenStatus ? status : null;

  const openPreview = () => {
    if (!preview) return;
    if (preview.status === 'active') navigation.navigate('ActiveQuest');
    else navigation.navigate('QuestDetail', { questId: preview.quest.id });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <GameMap
        player={{
          coordinate: world.position.coordinate,
          hue: st.hue,
          label: st.demoMode ? 'You (demo)' : world.position.kind === 'gps' ? 'You' : world.position.kind === 'simulated' ? 'You (sim)' : world.position.kind === 'manual' ? 'Chosen spot' : 'You (sample)',
        }}
        hubs={world.hubs}
        selectedId={selectedId ?? preview?.landmark.id ?? null}
        onSelectHub={(id) => {
          setSelectedId(id);
          const lm = world.lmById.get(id);
          if (lm) setFocus({ coordinate: lm.coordinate, token: Date.now() });
        }}
        onLongPress={onLongPress}
        recenterToken={recenterToken}
        focus={focus}
      />

      <View style={[styles.top, { paddingTop: insets.top + 8, paddingHorizontal: spacing.screen }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.navigate('You')} accessibilityRole="button" accessibilityLabel="Your profile">
            <GlassSurface style={styles.avatar}>
              <Critter hue={st.hue} size={36} />
            </GlassSurface>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('RegionPicker')}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${posLabel}. Change where you explore.`}
            style={{ flexShrink: 1 }}
          >
            <GlassSurface style={styles.locChip}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.text} />
              <Text style={[type.small, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                {posLabel}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} />
            </GlassSurface>
          </Pressable>
        </View>
        {visibleStatus && (
          <Pressable onPress={() => setHiddenStatus(visibleStatus.text)} accessibilityRole="button" accessibilityLabel={`${visibleStatus.text}. Dismiss`}>
            <Notice tone={visibleStatus.tone} icon={visibleStatus.tone === 'demo' ? 'flask-outline' : 'information-outline'} text={visibleStatus.text} />
          </Pressable>
        )}
        {gpsError && (
          <Pressable onPress={() => setGpsError(null)} accessibilityRole="button" accessibilityLabel="Dismiss location message">
            <Notice tone="warn" icon="map-marker-off-outline" text={`${gpsError} You can keep playing in a sample city.`} />
          </Pressable>
        )}
      </View>

      <View style={[styles.controls, { top: insets.top + 88 }]} pointerEvents="box-none">
        <IconButton icon="crosshairs-gps" label="Recenter on me" glass onPress={() => setRecenterToken((n) => n + 1)} />
        {world.position.kind === 'simulated' && (
          <IconButton
            icon="foot-print"
            label="Return to real position"
            glass
            onPress={() => {
              actions.clearSimulatedPosition();
              setRecenterToken((n) => n + 1);
            }}
          />
        )}
        {st.locationMode !== 'gps' && <IconButton icon="navigation-variant-outline" label={t('onboard.useLocation')} glass onPress={() => void requestMyLocation()} disabled={gpsBusy} />}
        <IconButton icon="refresh" label="Refresh quests" glass onPress={() => void actions.reloadWorld()} />
      </View>

      <Text style={[styles.attribution, type.tiny, { color: colors.textSecondary, bottom: bar + SHEET_COLLAPSED - 28, backgroundColor: colors.surface }]}>
        {st.demoMode && st.locationMode !== 'gps' ? 'Demo location · ' : ''}
        {t('explore.attribution')}
      </Text>

      <View style={[styles.sheetWrap, { bottom: bar - 8 }]} pointerEvents="box-none">
        <BottomSheet collapsed={SHEET_COLLAPSED} expanded={Math.min(Math.round(height * 0.62), 560)} peek={sheetPeek()}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={st.worldStatus === 'loading'} onRefresh={() => void actions.reloadWorld()} tintColor={colors.primary} />}
          >
            <View style={styles.filters}>
              <Filter label="Solo quests" value={st.preferSolo} onChange={(v) => actions.updateSettings({ preferSolo: v })} />
              <Filter label="Shorter walks" value={st.mobilityFriendly} onChange={(v) => actions.updateSettings({ mobilityFriendly: v })} />
            </View>
            {world.entries.map((item) => (
              <QuestCard
                key={item.quest.id}
                entry={item}
                units={st.units}
                selected={item.quest.id === preview?.quest.id}
                onPress={() => {
                  setSelectedId(item.landmark.id);
                  setFocus({ coordinate: item.landmark.coordinate, token: Date.now() });
                }}
              />
            ))}
          </ScrollView>
        </BottomSheet>
      </View>

      {!st.demoMode && (st.worldStatus === 'needs-location' || world.position.kind === 'none') && st.worldStatus !== 'loading' && (
        <LocationGate permission={st.permission} note={st.worldNote} busy={gpsBusy} onEnable={() => void requestMyLocation()} />
      )}
    </View>
  );

  function sheetPeek() {
    if (st.worldStatus === 'loading' && !preview) {
      return (
        <View style={styles.previewPad}>
          <Text style={type.subheading}>{t('explore.loading')}</Text>
        </View>
      );
    }
    if (!preview) {
      return (
        <View style={styles.previewPad}>
          <EmptyState icon="map-search-outline" title={t('explore.empty')} body={t('explore.emptyHint')} action={<Button label="Pick a region" onPress={() => navigation.navigate('RegionPicker')} />} />
        </View>
      );
    }
    const action = preview.status === 'active' ? t('quest.continue') : 'View quest';
    return <QuestPreview entry={preview} units={st.units} actionLabel={action} onPress={openPreview} />;
  }
}

function Filter({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.filter}>
      <Text style={type.small}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.surface} accessibilityLabel={label} />
    </View>
  );
}

function dataStatus(
  st: { worldStatus: string; worldNote: string | null; locationMode: string; questSource: string; demoMode: boolean },
  kind: string,
): { text: string; tone: 'info' | 'warn' | 'demo' } | null {
  if (st.worldStatus === 'error') return { text: 'Couldn’t refresh this area. Tap refresh or pull the quest list.', tone: 'warn' };
  if (st.worldNote) return { text: st.worldNote, tone: st.worldNote.startsWith('Showing saved places') ? 'info' : 'warn' };
  if (st.demoMode && kind !== 'gps') return { text: 'Demo location. Quests, parties, and your account are live.', tone: 'demo' };
  if (kind === 'simulated') return { text: 'Simulated position', tone: 'demo' };
  if ((st.locationMode === 'region' || kind === 'sample') && st.questSource === 'local') return { text: 'Sample places', tone: 'demo' };
  if (st.questSource === 'local') return { text: 'Built-in quests', tone: 'demo' };
  if (st.questSource === 'mixed') return { text: 'Some quests are built-in', tone: 'demo' };
  return null;
}

function LocationGate({ permission, note, busy, onEnable }: { permission: string; note: string | null; busy: boolean; onEnable: () => void }) {
  const { colors, type } = useTheme();
  const denied = permission === 'denied';
  return (
    <View style={[styles.scrim, { backgroundColor: colors.bg }]} accessibilityViewIsModal>
      <View style={[styles.onboard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Critter hue={28} size={84} mood="sleepy" />
        <Text style={[type.title, { textAlign: 'center' }]}>{denied ? 'Location is off' : 'Thaw needs your location'}</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>
          {note ?? 'Real quests are built from public places near you. Location stays on this phone and is never shared with other players.'}
        </Text>
        <Button label={denied ? 'Try location again' : 'Enable location'} icon="crosshairs-gps" onPress={onEnable} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 72, gap: 8, zIndex: 2, elevation: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  locChip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, maxWidth: 240, paddingHorizontal: 12, borderRadius: 22 },
  controls: { position: 'absolute', right: 16, gap: 8, zIndex: 2, elevation: 4 },
  attribution: { position: 'absolute', left: 16, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', maxWidth: '70%' },
  sheetWrap: { position: 'absolute', left: 12, right: 12, zIndex: 3, elevation: 6 },
  previewPad: { paddingHorizontal: 16, paddingBottom: 12 },
  filters: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  filter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,24,21,0.45)', justifyContent: 'flex-end', padding: 16, zIndex: 5, elevation: 8 },
  onboard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 10, alignItems: 'stretch' },
});
