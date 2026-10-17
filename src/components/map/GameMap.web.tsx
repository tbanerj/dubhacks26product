/**
 * Web fallback (react-native-maps has no web support). Draws an illustrated
 * "treasure board" projection of the same hubs so the game is playable and
 * reviewable in a browser. Native builds use GameMap.tsx.
 */
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { GameMapProps } from './types';
import { HUB_LABEL, HubMarker, PlayerMarker } from '../Markers';
import { CATEGORY_STYLE } from '../../theme/palette';
import { colors, fonts } from '../../theme/tokens';

function GameMapWeb({ player, hubs, selectedId, onSelectHub }: GameMapProps) {
  const [size, setSize] = useState({ w: 360, h: 640 });

  // Radial square-root projection: keeps true bearings but spreads out nearby
  // clusters, like an illustrated park map rather than a surveyed one.
  const project = useMemo(() => {
    const cosLat = Math.cos((player.coordinate.latitude * Math.PI) / 180);
    const offset = (c: { latitude: number; longitude: number }) => {
      const dx = (c.longitude - player.coordinate.longitude) * cosLat;
      const dy = c.latitude - player.coordinate.latitude;
      const r = Math.hypot(dx, dy);
      const k = r > 0 ? Math.sqrt(r) / r : 0;
      return { x: dx * k, y: dy * k };
    };
    let maxX = 0.03;
    let maxY = 0.03;
    for (const h of hubs) {
      const o = offset(h.landmark.coordinate);
      maxX = Math.max(maxX, Math.abs(o.x));
      maxY = Math.max(maxY, Math.abs(o.y));
    }
    const scale = Math.min((size.w * 0.4) / maxX, (size.h * 0.24) / maxY);
    return (c: { latitude: number; longitude: number }) => {
      const o = offset(c);
      return { x: size.w / 2 + o.x * scale, y: size.h * 0.38 - o.y * scale };
    };
  }, [player.coordinate, hubs, size]);

  const me = project(player.coordinate);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.w} height={size.h} fill="#F3E4C6" />
        {/* decorative streets & parks – illustrative only */}
        <Path d={`M0 ${size.h * 0.3} C ${size.w * 0.3} ${size.h * 0.25}, ${size.w * 0.6} ${size.h * 0.4}, ${size.w} ${size.h * 0.33}`} stroke="#FFF9EE" strokeWidth={18} fill="none" />
        <Path d={`M${size.w * 0.35} 0 C ${size.w * 0.4} ${size.h * 0.3}, ${size.w * 0.3} ${size.h * 0.6}, ${size.w * 0.45} ${size.h}`} stroke="#FFF9EE" strokeWidth={14} fill="none" />
        <Path d={`M0 ${size.h * 0.62} L ${size.w} ${size.h * 0.55}`} stroke="#FFF9EE" strokeWidth={10} fill="none" />
        <Path d={`M${size.w * 0.7} 0 L ${size.w * 0.78} ${size.h}`} stroke="#FFF9EE" strokeWidth={10} fill="none" />
        <Path d={`M${size.w * 0.05} ${size.h * 0.08} q 60 -20 110 20 t 40 70 q -50 40 -120 10 z`} fill="#CFE3B2" stroke="#A9C98A" strokeWidth={2} />
        <Path d={`M${size.w * 0.62} ${size.h * 0.66} q 70 -10 100 30 t -10 70 q -70 20 -100 -20 z`} fill="#CFE3B2" stroke="#A9C98A" strokeWidth={2} />
        <Path d={`M${size.w * 0.85} ${size.h * 0.05} q 40 30 20 90 q -40 30 -60 -10 z`} fill="#B9DCD8" stroke="#8FC0BB" strokeWidth={2} />
      </Svg>

      {hubs.map((h) => {
        const p = project(h.landmark.coordinate);
        const selected = h.landmark.id === selectedId;
        return (
          <Pressable
            key={h.landmark.id}
            onPress={() => onSelectHub(h.landmark.id)}
            accessibilityRole="button"
            accessibilityLabel={`${h.landmark.name}, ${CATEGORY_STYLE[h.landmark.category].label}, ${HUB_LABEL[h.state]}`}
            style={[styles.hub, { left: p.x - 32, top: p.y - 74, zIndex: selected ? 10 : 5 }]}
          >
            <HubMarker category={h.landmark.category} state={h.state} selected={selected} />
            <Text style={styles.hubLabel} numberOfLines={1}>
              {h.landmark.name}
            </Text>
          </Pressable>
        );
      })}

      <View style={[styles.player, { left: me.x - 29, top: me.y - 34 }]} pointerEvents="none">
        <PlayerMarker hue={player.hue} label={player.label} />
      </View>
    </View>
  );
}

export const GameMap = memo(GameMapWeb);

const styles = StyleSheet.create({
  hub: { position: 'absolute', width: 64, alignItems: 'center' },
  hubLabel: {
    marginTop: -6,
    maxWidth: 110,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
    backgroundColor: colors.paper,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  player: { position: 'absolute', zIndex: 20 },
});
