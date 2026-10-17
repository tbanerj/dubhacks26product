import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { RootScreenProps } from '../navigation/types';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { HubMarker } from '../components/Markers';
import { colors, fonts, spacing } from '../theme/tokens';
import type { LandmarkCategory } from '../types';
import { t } from '../i18n/strings';

const ICE = '#CFE6EE';
const ICE_DEEP = '#A9D1DE';
const TITLE = 'Thaw'.split('');

const PINS: { category: LandmarkCategory; x: number; y: number; delay: number }[] = [
  { category: 'park', x: 0.16, y: 0.44, delay: 0 },
  { category: 'library', x: 0.74, y: 0.38, delay: 120 },
  { category: 'artwork', x: 0.84, y: 0.5, delay: 240 },
  { category: 'fountain', x: 0.26, y: 0.62, delay: 360 },
];

/** Warm "paper map" world that the ice melts away from. Purely decorative. */
function WarmWorld({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={w} height={h} fill={colors.paper} />
      <Path d={`M0 ${h * 0.52} C ${w * 0.3} ${h * 0.46}, ${w * 0.6} ${h * 0.6}, ${w} ${h * 0.5}`} stroke="#F3E2C2" strokeWidth={26} fill="none" />
      <Path d={`M${w * 0.42} ${h * 0.25} C ${w * 0.5} ${h * 0.45}, ${w * 0.36} ${h * 0.65}, ${w * 0.5} ${h}`} stroke="#F3E2C2" strokeWidth={20} fill="none" />
      <Path d={`M0 ${h * 0.74} L ${w} ${h * 0.68}`} stroke="#F3E2C2" strokeWidth={14} fill="none" />
      <Path d={`M${w * 0.04} ${h * 0.33} q 70 -24 130 18 t 40 80 q -60 44 -140 10 z`} fill={colors.grassSoft} stroke={colors.grass} strokeWidth={2} />
      <Path d={`M${w * 0.62} ${h * 0.7} q 80 -14 116 30 t -10 80 q -80 24 -116 -24 z`} fill={colors.grassSoft} stroke={colors.grass} strokeWidth={2} />
      <Path d={`M${w * 0.8} ${h * 0.22} q 46 34 24 100 q -46 34 -68 -12 z`} fill={colors.skySoft} stroke={colors.sky} strokeWidth={2} />
    </Svg>
  );
}

/** Frost sheet with a dripping bottom edge and a few crystal sparkles. */
function IceSheet({ w, h }: { w: number; h: number }) {
  const drips = useMemo(() => {
    const n = 9;
    let d = `M0 0 L${w} 0 L${w} ${h}`;
    for (let i = n; i >= 0; i--) {
      const x = (i / n) * w;
      const depth = 18 + ((i * 37) % 5) * 9;
      d += ` Q ${x + w / n / 2} ${h + depth} ${x} ${h}`;
    }
    return `${d} Z`;
  }, [w, h]);
  const flakes = [
    [0.18, 0.18, 10],
    [0.72, 0.12, 14],
    [0.84, 0.46, 9],
    [0.3, 0.52, 12],
    [0.55, 0.3, 8],
    [0.12, 0.78, 11],
    [0.68, 0.84, 13],
  ] as const;
  return (
    <Svg width={w} height={h + 60} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Path d={drips} fill={ICE} />
      <Path d={`M0 ${h * 0.12} L${w} ${h * 0.02}`} stroke="#E7F4F8" strokeWidth={10} opacity={0.7} />
      <Path d={`M0 ${h * 0.4} L${w} ${h * 0.28}`} stroke="#E7F4F8" strokeWidth={6} opacity={0.6} />
      {flakes.map(([fx, fy, r], i) => (
        <G key={i} transform={`translate(${fx * w} ${fy * h})`} opacity={0.85}>
          <Path d={`M0 ${-r} L0 ${r} M${-r} 0 L${r} 0 M${-r * 0.7} ${-r * 0.7} L${r * 0.7} ${r * 0.7} M${-r * 0.7} ${r * 0.7} L${r * 0.7} ${-r * 0.7}`} stroke={ICE_DEEP} strokeWidth={2} strokeLinecap="round" />
          <Circle r={2.4} fill="#FFFFFF" />
        </G>
      ))}
    </Svg>
  );
}

function Sun({ spin }: { spin: Animated.Value }) {
  const rays = Array.from({ length: 12 }, (_, i) => i);
  return (
    <View style={styles.sunWrap} pointerEvents="none">
      <Animated.View style={{ position: 'absolute', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Svg width={220} height={220} viewBox="-110 -110 220 220">
          {rays.map((i) => (
            <Path key={i} d="M-9 -64 L0 -104 L9 -64 Z" fill={colors.butter} stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" transform={`rotate(${i * 30})`} />
          ))}
        </Svg>
      </Animated.View>
      <Svg width={130} height={130} viewBox="-65 -65 130 130">
        <Circle r={58} fill={colors.sunset} stroke={colors.ink} strokeWidth={3} />
        <Circle r={44} fill={colors.butter} opacity={0.65} />
        <Path d="M-30 -22 C -18 -40, 10 -44, 26 -30" stroke={colors.white} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.7} />
      </Svg>
    </View>
  );
}

export function IntroScreen({ navigation }: RootScreenProps<'Intro'>) {
  const { width: w, height: h } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Animated values live in state (stable across renders; React Compiler friendly).
  const [melt] = useState(() => new Animated.Value(0));
  const [sunRise] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [critter] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const [cta] = useState(() => new Animated.Value(0));
  const [letters] = useState(() => TITLE.map(() => new Animated.Value(0)));
  const [pins] = useState(() => PINS.map(() => new Animated.Value(0)));

  useEffect(() => {
    let cancelled = false;
    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24_000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        const all = [melt, sunRise, critter, cta, ...letters, ...pins];
        if (reduce) {
          all.forEach((v) => v.setValue(1));
          return;
        }
        loops.forEach((l) => l.start());
        // Every step runs on its own clock (no step waits for another to "finish"), so a
        // decorative spring can never hold back the buttons.
        const at = (ms: number, anim: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), anim]);
        const pop = (v: Animated.Value, duration: number, overshoot: number) =>
          Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.back(overshoot)), useNativeDriver: true });
        const T = 200;
        Animated.parallel([
          at(T, Animated.timing(sunRise, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
          at(T + 300, Animated.timing(melt, { toValue: 1, duration: 1400, easing: Easing.in(Easing.quad), useNativeDriver: true })),
          ...pins.map((p, i) => at(T + 1200 + i * 110, pop(p, 520, 2.2))),
          at(T + 1650, pop(critter, 560, 2.4)),
          ...letters.map((l, i) => at(T + 1900 + i * 90, pop(l, 460, 2.6))),
          at(T + 2450, pop(cta, 420, 1.4)),
        ]).start();
      });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [melt, sunRise, spin, critter, bob, cta, letters, pins]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={styles.root}>
      <WarmWorld w={w} h={h} />

      {PINS.map((p, i) => {
        const v = pins[i]!;
        return (
          <Animated.View
            key={p.category}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: p.x * w - 32,
              top: p.y * h - 70,
              opacity: v,
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }, { translateY: bobY }],
            }}
          >
            <HubMarker category={p.category} state={i === 0 ? 'new' : i === 2 ? 'coop' : 'available'} />
          </Animated.View>
        );
      })}

      <Animated.View
        pointerEvents="none"
        style={[styles.sunAnchor, { top: insets.top + h * 0.06, opacity: sunRise, transform: [{ translateY: sunRise.interpolate({ inputRange: [0, 1], outputRange: [h * 0.5, 0] }) }, { scale: sunRise.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
      >
        <Sun spin={spin} />
      </Animated.View>

      {/* The frost that melts away. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: melt.interpolate({ inputRange: [0, 1], outputRange: [0, h + 80] }) }] }]}
      >
        <IceSheet w={w} h={h} />
      </Animated.View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View style={{ alignItems: 'center', opacity: critter, transform: [{ translateY: critter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }, { translateY: bobY }] }}>
          <View style={styles.critterHalo}>
            <Critter hue={28} size={96} mood="wow" />
          </View>
        </Animated.View>

        <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel="Thaw">
          {TITLE.map((ch, i) => {
            const v = letters[i]!;
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.title,
                  {
                    opacity: v,
                    transform: [
                      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${i % 2 ? 12 : -12}deg`, `${i % 2 ? 3 : -3}deg`] }) },
                      { scale: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.15, 1] }) },
                    ],
                  },
                ]}
              >
                {ch}
              </Animated.Text>
            );
          })}
        </View>
        <Animated.Text style={[styles.tagline, { opacity: cta }]}>{t('tagline')}</Animated.Text>

        <Animated.View style={{ width: '100%', gap: spacing.sm, opacity: cta, transform: [{ translateY: cta.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}>
          <Button label="Create account" icon="account-plus" variant="sunset" onPress={() => navigation.navigate('Auth', { mode: 'signUp' })} />
          <Button label="Log in" icon="login" variant="secondary" onPress={() => navigation.navigate('Auth', { mode: 'signIn' })} />
          <Text style={styles.fine}>Free to play. Quests happen at real public places near you.</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, overflow: 'hidden' },
  sunAnchor: { position: 'absolute', alignSelf: 'center' },
  sunWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.sm },
  critterHalo: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.butterSoft,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 76,
    lineHeight: 84,
    color: colors.forest,
    textShadowColor: colors.ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
    marginHorizontal: 1,
  },
  tagline: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  fine: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
});
