import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { useWorld } from '../hooks/useWorld';
import { GameMap } from '../components/map/GameMap';
import { PlayerPlate, DemoBadge } from '../components/Hud';
import { QuestCard } from '../components/QuestCard';
import { Button } from '../components/Button';
import { Card, EmptyState, Notice } from '../components/Paper';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { CATEGORY_STYLE } from '../theme/palette';
import { regionById } from '../data/regions';
import { formatDistance } from '../utils/format';
import { watchPosition } from '../services/location';
import { TAB_BAR_SPACE } from '../navigation/TabBar';
import { t } from '../i18n/strings';
import { HUB_LABEL } from '../components/Markers';

export function ExploreScreen({ navigation, route }: TabScreenProps<'Explore'>) {
  const insets = useSafeAreaInsets();
  const world = useWorld();
  const st = useGameStore(
    useShallow((s) => ({
      hue: s.player.avatarHue,
      units: s.settings.units,
      demoMode: s.settings.demoMode,
      onboarded: s.settings.onboarded,
      worldStatus: s.worldStatus,
      worldNote: s.worldNote,
      locationMode: s.locationMode,
      regionId: s.regionId,
      landmarksCount: s.landmarks.length,
      questSource: s.questSource,
      permission: s.permission,
    })),
  );
  const actions = useGameStore(
    useShallow((s) => ({
      enableGps: s.enableGps,
      setRegion: s.setRegion,
      setManualCenter: s.setManualCenter,
      finishOnboarding: s.finishOnboarding,
      clearSimulatedPosition: s.clearSimulatedPosition,
      reloadWorld: s.reloadWorld,
    })),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [focus, setFocus] = useState<{ coordinate: { latitude: number; longitude: number }; token: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // First load: restore persisted world, or build one for the saved region.
  useEffect(() => {
    const s = useGameStore.getState();
    if (s.landmarks.length > 0) {
      useGameStore.setState({ worldStatus: 'ready' });
      if (s.locationMode === 'gps') void s.refreshGps();
      return;
    }
    if (s.worldStatus === 'idle') void s.setRegion(s.regionId);
  }, []);

  // Keep GPS position fresh while exploring with real location.
  useEffect(() => {
    if (st.locationMode !== 'gps' || st.permission !== 'granted') return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void watchPosition((c) => useGameStore.setState({ gpsPosition: c })).then((unsub) => {
      if (cancelled) unsub();
      else stop = unsub;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [st.locationMode, st.permission]);

  // Deep-link from other screens: focus a landmark (state adjusted during render, React's
  // recommended pattern for reacting to changed props/params).
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
    actions.finishOnboarding();
    if (res.ok) setRecenterToken((n) => n + 1);
    else setGpsError(`${res.reason ?? 'Location unavailable.'} You can keep playing in a sample city.`);
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
  const selectedHub = world.hubs.find((h) => h.landmark.id === selectedId) ?? null;
  const region = regionById(st.regionId);

  const posLabel =
    world.position.kind === 'gps'
      ? t('explore.gps')
      : world.position.kind === 'simulated'
        ? t('explore.simulated')
        : world.position.kind === 'manual'
          ? t('explore.manual')
          : `${region?.name ?? ''} · ${t('explore.sampleLocation')}`;

  const openQuest = (questId: string) => navigation.navigate('QuestDetail', { questId });

  return (
    <View style={styles.root}>
      <GameMap
        player={{ coordinate: world.position.coordinate, hue: st.hue, label: world.position.kind === 'gps' ? 'You' : world.position.kind === 'simulated' ? 'You (sim)' : 'You (sample)' }}
        hubs={world.hubs}
        selectedId={selectedId}
        onSelectHub={setSelectedId}
        onLongPress={onLongPress}
        recenterToken={recenterToken}
        focus={focus}
      />

      {/* Top HUD */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.row}>
          <PlayerPlate onPress={() => navigation.navigate('Profile')} />
        </View>
        <View style={styles.row}>
          <Pressable
            style={styles.locChip}
            onPress={() => navigation.navigate('RegionPicker')}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${posLabel}. Change region or location.`}
          >
            <MaterialCommunityIcons name={world.position.kind === 'gps' ? 'crosshairs-gps' : world.position.kind === 'simulated' ? 'foot-print' : 'map-search-outline'} size={16} color={colors.ink} />
            <Text style={styles.locText} numberOfLines={1}>
              {posLabel}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.ink} />
          </Pressable>
          {st.demoMode && <DemoBadge />}
          {st.worldStatus === 'loading' && (
            <View style={styles.loadingChip} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.forest} />
              <Text style={styles.locText}>{t('explore.loading')}</Text>
            </View>
          )}
        </View>
        {st.worldNote && st.worldStatus === 'ready' && (
          <View style={{ marginTop: spacing.xs }}>
            <Notice tone="warn" text={st.worldNote} />
          </View>
        )}
      </View>

      {/* Map controls */}
      <View style={[styles.controls, { top: insets.top + 132 }]} pointerEvents="box-none">
        <RoundButton icon="crosshairs-gps" label="Recenter on me" onPress={() => setRecenterToken((n) => n + 1)} />
        {world.position.kind === 'simulated' && (
          <RoundButton icon="foot-print" label="Return to real position" onPress={() => { actions.clearSimulatedPosition(); setRecenterToken((n) => n + 1); }} />
        )}
        {st.locationMode !== 'gps' && <RoundButton icon="navigation-variant-outline" label={t('onboard.useLocation')} onPress={() => void requestMyLocation()} busy={gpsBusy} />}
        <RoundButton icon="refresh" label="Refresh quests" onPress={() => void actions.reloadWorld()} />
      </View>

      <Text style={[styles.attribution, { bottom: TAB_BAR_SPACE + (selectedHub ? 250 : 210) }]}>
        {st.locationMode === 'region' ? 'Demo places · ' : ''}
        {t('explore.attribution')}
      </Text>

      {/* Bottom tray */}
      <View style={[styles.tray, { bottom: TAB_BAR_SPACE - 8 }]} pointerEvents="box-none">
        {world.active && !selectedHub && (
          <Pressable style={styles.activeBanner} onPress={() => navigation.navigate('ActiveQuest')} accessibilityRole="button" accessibilityLabel={`Active quest: ${world.active.quest.title}. Open.`}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <Text style={type.tiny}>ACTIVE QUEST · {formatDistance(world.active.distanceM, st.units)}</Text>
              <Text style={type.subheading} numberOfLines={1}>
                {world.active.quest.title}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.ink} />
          </Pressable>
        )}

        {selectedHub ? (
          <Card style={styles.hubCard} tint={colors.paper}>
            <View style={styles.hubHeader}>
              <View style={[styles.hubIcon, { backgroundColor: CATEGORY_STYLE[selectedHub.landmark.category].color }]}>
                <MaterialCommunityIcons name={CATEGORY_STYLE[selectedHub.landmark.category].icon} size={20} color={colors.paper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.heading} numberOfLines={1}>
                  {selectedHub.landmark.name}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {CATEGORY_STYLE[selectedHub.landmark.category].label} · {HUB_LABEL[selectedHub.state]}
                  {selectedHub.landmark.source === 'openstreetmap' ? ' · OSM' : ''}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedId(null)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={selectedEntries}
              keyExtractor={(e) => e.quest.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
              renderItem={({ item }) => <QuestCard entry={item} units={st.units} width={280} onPress={() => openQuest(item.quest.id)} />}
            />
          </Card>
        ) : st.worldStatus === 'ready' && world.entries.length === 0 ? (
          <Card tint={colors.paper}>
            <EmptyState
              icon="map-search-outline"
              title={t('explore.empty')}
              body={t('explore.emptyHint')}
              action={<Button label="Pick a region" icon="earth" onPress={() => navigation.navigate('RegionPicker')} compact />}
            />
          </Card>
        ) : (
          <View>
            <View style={styles.trayTitle}>
              <Text style={[type.heading, styles.trayTitleText]}>{t('explore.nearby')}</Text>
              <Text style={[type.small, styles.trayTitleText]}>
                {world.entries.filter((e) => e.status !== 'completed').length} open
                {st.questSource !== 'local' ? ' · AI quests' : ''}
              </Text>
            </View>
            <FlatList
              horizontal
              data={world.entries}
              keyExtractor={(e) => e.quest.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
              renderItem={({ item }) => (
                <QuestCard
                  entry={item}
                  units={st.units}
                  width={270}
                  onPress={() => {
                    setSelectedId(item.landmark.id);
                    setFocus({ coordinate: item.landmark.coordinate, token: Date.now() });
                    openQuest(item.quest.id);
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.skeleton}>
                  <ActivityIndicator color={colors.forest} />
                  <Text style={type.small}>{t('explore.loading')}</Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      {!st.onboarded && <Onboarding onLocation={() => void requestMyLocation()} onSample={() => { actions.finishOnboarding(); navigation.navigate('RegionPicker'); }} onSkip={actions.finishOnboarding} busy={gpsBusy} hue={st.hue} />}

      {gpsError && (
        <View style={[styles.toast, { top: insets.top + 130 }]}>
          <Notice tone="warn" icon="map-marker-off-outline" text={gpsError} />
          <Pressable onPress={() => setGpsError(null)} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.toastClose}>
            <MaterialCommunityIcons name="close" size={18} color={colors.ink} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function RoundButton({ icon, label, onPress, busy }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.round, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button" accessibilityLabel={label} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color={colors.forest} /> : <MaterialCommunityIcons name={icon} size={22} color={colors.ink} />}
    </Pressable>
  );
}

function Onboarding({ onLocation, onSample, onSkip, busy, hue }: { onLocation: () => void; onSample: () => void; onSkip: () => void; busy: boolean; hue: number }) {
  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <Card style={styles.onboard} tint={colors.paper}>
        <View style={{ alignItems: 'center', marginTop: -56 }}>
          <View style={styles.onboardAvatar}>
            <Critter hue={hue} size={84} mood="wow" />
          </View>
        </View>
        <Text style={[type.tiny, { textAlign: 'center', color: colors.sunsetDeep }]}>WELCOME TO THAW</Text>
        <Text style={[type.title, { textAlign: 'center' }]}>{t('onboard.title')}</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>{t('onboard.body')}</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button label={t('onboard.useLocation')} icon="crosshairs-gps" onPress={onLocation} loading={busy} />
          <Text style={[type.small, { textAlign: 'center' }]}>{t('onboard.locationNote')}</Text>
          <Button label={t('onboard.sample')} icon="earth" variant="secondary" onPress={onSample} />
          <Button label="Just show me the map" variant="ghost" onPress={onSkip} compact />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paperDeep },
  top: { position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 260,
    minHeight: 36,
  },
  loadingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.grassSoft,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, flexShrink: 1 },
  controls: { position: 'absolute', right: spacing.md, gap: spacing.sm },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: {
    position: 'absolute',
    left: spacing.md,
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: colors.inkSoft,
    backgroundColor: 'rgba(255,247,232,0.85)',
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tray: { position: 'absolute', left: 0, right: 0, gap: spacing.sm },
  trayTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  trayTitleText: { backgroundColor: colors.paper, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  activeBanner: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.sunset,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  hubCard: { marginHorizontal: spacing.md, padding: spacing.md, gap: spacing.sm },
  hubHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hubIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skeleton: {
    width: 270,
    height: 150,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(48,55,45,0.45)', justifyContent: 'center', padding: spacing.lg },
  onboard: { gap: spacing.sm, paddingTop: spacing.lg },
  onboardAvatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: colors.butter, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', left: spacing.md, right: 72 },
  toastClose: { position: 'absolute', right: 4, top: 4, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
