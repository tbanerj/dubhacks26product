import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootScreenProps } from '../navigation/types';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { HubMarker } from '../components/Markers';
import { PinArt } from '../components/PinArt';
import { Notice } from '../components/Paper';
import { colors, radii, spacing, type } from '../theme/tokens';
import { useGameStore } from '../store/useGameStore';
import * as LocationService from '../services/location';
import type { IconName } from '../theme/palette';

interface Page {
  kicker: string;
  title: string;
  body: string;
  points: { icon: IconName; text: string }[];
  art: React.ReactNode;
  bg: string;
}

function ArtCity() {
  return (
    <View style={styles.art}>
      <View style={[styles.blob, { backgroundColor: colors.grassSoft, left: 10, top: 30 }]} />
      <View style={[styles.blob, { backgroundColor: colors.skySoft, right: 0, bottom: 10, width: 120 }]} />
      <View style={{ position: 'absolute', left: 30, top: 40 }}>
        <HubMarker category="park" state="new" />
      </View>
      <View style={{ position: 'absolute', right: 40, top: 10 }}>
        <HubMarker category="library" state="available" />
      </View>
      <View style={{ position: 'absolute', right: 70, bottom: 30 }}>
        <HubMarker category="artwork" state="active" selected />
      </View>
      <View style={{ position: 'absolute', left: 100, bottom: 0 }}>
        <Critter hue={28} size={72} mood="wow" />
      </View>
    </View>
  );
}

function ArtParty() {
  return (
    <View style={[styles.art, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: -6 }]}>
      <Critter hue={150} size={78} />
      <View style={{ marginBottom: 18 }}>
        <Critter hue={28} size={104} mood="wow" />
      </View>
      <Critter hue={330} size={78} />
      <Critter hue={200} size={70} mood="sleepy" />
    </View>
  );
}

function ArtPins() {
  return (
    <View style={[styles.art, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: spacing.sm }]}>
      <PinArt theme="botanical" rarity="common" size={78} />
      <PinArt theme="architecture" rarity="rare" size={96} />
      <PinArt theme="cooperative" rarity="legendary" size={78} />
      <PinArt theme="culture" rarity="uncommon" size={70} />
      <PinArt theme="hidden" rarity="rare" size={70} />
    </View>
  );
}

const PAGES: Page[] = [
  {
    kicker: 'STEP 1 OF 3',
    title: 'Your city is the game board',
    body: 'Thaw turns real public places near you – parks, libraries, squares, murals – into quests.',
    points: [
      { icon: 'map-marker-radius', text: 'Walk to a quest and check in when you’re there.' },
      { icon: 'camera-outline', text: 'Snap a photo of what you found. Our AI checks it, never faces.' },
      { icon: 'shield-check-outline', text: 'Quests stick to safe, public, daylight-friendly places.' },
    ],
    art: <ArtCity />,
    bg: colors.butterSoft,
  },
  {
    kicker: 'STEP 2 OF 3',
    title: 'Better together, never forced',
    body: 'Start a party with a 6-letter code and explore with up to 3 friends for bonus XP.',
    points: [
      { icon: 'account-group', text: 'Party quests and chat with people you invite.' },
      { icon: 'walk', text: 'Every social quest has a solo version. Saying no is always fine.' },
      { icon: 'eye-off-outline', text: 'Nobody sees your exact location. Never share your address.' },
    ],
    art: <ArtParty />,
    bg: colors.sunsetSoft,
  },
  {
    kicker: 'STEP 3 OF 3',
    title: 'Collect pins, climb the ranks',
    body: 'Every place you discover earns an illustrated pin and XP on the global leaderboard.',
    points: [
      { icon: 'pin', text: 'Pins come in botanical, architecture, culture and more.' },
      { icon: 'trophy-outline', text: 'Daily and all-time boards, scored on our servers.' },
      { icon: 'fire', text: 'Keep a streak by exploring on consecutive days.' },
    ],
    art: <ArtPins />,
    bg: colors.grassSoft,
  },
];

export function OnboardingScreen(_props: RootScreenProps<'Onboarding'>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const [busy, setBusy] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const name = useGameStore((s) => s.player.name);
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);
  const enableGps = useGameStore((s) => s.enableGps);
  const last = page === PAGES.length - 1;

  const goTo = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const finish = async (askLocation: boolean) => {
    setBusy(true);
    if (askLocation) {
      const perm = await LocationService.requestPermission();
      if (perm !== 'granted') {
        setLocNote('No problem – you can turn on location any time from the map. Thaw needs it to find quests near you.');
        setBusy(false);
        return;
      }
      void enableGps();
    }
    await completeOnboarding();
    setBusy(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={type.small}>Welcome, {name}!</Text>
        {!last && <Button label="Skip" variant="ghost" compact onPress={() => goTo(PAGES.length - 1)} />}
      </View>

      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true })}
        style={{ flex: 1 }}
      >
        {PAGES.map((p, i) => (
          <View key={i} style={[styles.page, { width }]} accessible accessibilityLabel={`${p.title}. ${p.body}`}>
            <View style={[styles.artCard, { backgroundColor: p.bg }]}>{p.art}</View>
            <Text style={[type.tiny, { color: colors.sunsetDeep }]}>{p.kicker}</Text>
            <Text style={[type.title, { textAlign: 'center' }]} accessibilityRole="header">
              {p.title}
            </Text>
            <Text style={[type.body, { textAlign: 'center' }]}>{p.body}</Text>
            <View style={styles.points}>
              {p.points.map((pt) => (
                <View key={pt.text} style={styles.point}>
                  <View style={styles.pointIcon}>
                    <MaterialCommunityIcons name={pt.icon} size={18} color={colors.ink} />
                  </View>
                  <Text style={[type.body, { flex: 1 }]}>{pt.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: PAGES.length, now: page + 1 }}>
        {PAGES.map((_, i) => {
          const scale = x.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [1, 2.4, 1], extrapolate: 'clamp' });
          return <Animated.View key={i} style={[styles.dot, { transform: [{ scaleX: scale }], backgroundColor: i === page ? colors.forest : colors.paperEdge }]} />;
        })}
      </View>

      <View style={styles.actions}>
        {locNote && <Notice tone="warn" icon="map-marker-off-outline" text={locNote} />}
        {last ? (
          <>
            <Button label="Enable location & start" icon="crosshairs-gps" variant="sunset" onPress={() => void finish(true)} loading={busy} />
            <Button label={locNote ? 'Continue without location' : 'Not now'} variant="ghost" compact onPress={() => void finish(false)} />
            <Text style={[type.small, { textAlign: 'center' }]}>Approximate location, only while the app is open. Never shared with other players.</Text>
          </>
        ) : (
          <Button label="Next" icon="arrow-right" onPress={() => goTo(page + 1)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, minHeight: 44 },
  page: { paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.sm },
  artCard: {
    width: '100%',
    height: 240,
    borderRadius: radii.xl,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: colors.ink,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  art: { flex: 1, padding: spacing.md },
  blob: { position: 'absolute', width: 140, height: 100, borderRadius: 60, borderWidth: 2, borderColor: colors.ink },
  points: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pointIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.butter, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.ink },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.sm },
});
