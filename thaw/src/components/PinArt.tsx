import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { CollectibleTheme, Rarity } from '../types';
import { colors } from '../theme/tokens';
import { RARITY_STYLE, THEME_STYLE } from '../theme/palette';

/** Original enamel-pin illustrations, one per collectible theme. */
function Motif({ theme, ink, accent }: { theme: CollectibleTheme; ink: string; accent: string }) {
  const s = { stroke: ink, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (theme) {
    case 'botanical':
      return (
        <G>
          <Path d="M32 48 C20 44 16 30 22 18 C34 20 44 30 40 44 C38 47 35 48 32 48 Z" fill={colors.grass} {...s} />
          <Path d="M32 48 C30 38 28 30 23 21" fill="none" {...s} />
          <Path d="M30 36 L24 33 M31 42 L26 41 M29 30 L33 27" fill="none" {...s} strokeWidth={2} />
          <Circle cx={42} cy={20} r={4} fill={colors.butter} {...s} strokeWidth={2} />
        </G>
      );
    case 'architecture':
      return (
        <G>
          <Path d="M16 46 L16 28 C16 18 24 13 32 13 C40 13 48 18 48 28 L48 46 Z" fill={colors.paper} {...s} />
          <Path d="M24 46 L24 30 C24 25 28 22 32 22 C36 22 40 25 40 30 L40 46" fill={accent} {...s} />
          <Rect x={12} y={44} width={40} height={6} rx={2} fill={colors.clay} {...s} />
          <Circle cx={32} cy={17.5} r={1.8} fill={ink} />
        </G>
      );
    case 'culture':
      return (
        <G>
          <Path d="M26 14 L38 14" {...s} fill="none" />
          <Path d="M20 22 C20 17 25 15 32 15 C39 15 44 17 44 22 L44 40 C44 45 39 47 32 47 C25 47 20 45 20 40 Z" fill={colors.sunset} {...s} />
          <Path d="M20 26 L44 26 M20 36 L44 36" {...s} fill="none" strokeWidth={2} />
          <Path d="M28 47 L28 51 M36 47 L36 51" {...s} fill="none" />
          <Circle cx={32} cy={31} r={3} fill={colors.butter} {...s} strokeWidth={2} />
        </G>
      );
    case 'hidden':
      return (
        <G>
          <Circle cx={29} cy={29} r={12} fill={colors.skySoft} {...s} />
          <Path d="M38 38 L48 48" {...s} strokeWidth={5} fill="none" />
          <Path d="M29 24 C26.5 24 25 26 25 28 C25 29.6 26 30.8 27 31.3 L26.5 35 L31.5 35 L31 31.3 C32 30.8 33 29.6 33 28 C33 26 31.5 24 29 24 Z" fill={ink} />
        </G>
      );
    case 'cooperative':
      return (
        <G>
          <Circle cx={24} cy={27} r={9} fill={colors.sunset} {...s} />
          <Circle cx={40} cy={27} r={9} fill={colors.grass} {...s} />
          <Circle cx={32} cy={40} r={9} fill={colors.butter} {...s} />
          <Path d="M28 33 L36 33" {...s} fill="none" strokeWidth={2} />
        </G>
      );
    case 'neighborhood':
    default:
      return (
        <G>
          <Path d="M14 30 L32 15 L50 30" {...s} fill="none" />
          <Path d="M18 28 L18 48 L46 48 L46 28 L32 17 Z" fill={colors.paper} {...s} />
          <Rect x={27} y={34} width={10} height={14} rx={1.5} fill={accent} {...s} strokeWidth={2} />
          <Rect x={21} y={31} width={5} height={5} fill={colors.butter} {...s} strokeWidth={1.8} />
          <Rect x={38} y={31} width={5} height={5} fill={colors.butter} {...s} strokeWidth={1.8} />
        </G>
      );
  }
}

export function PinArt({ theme, rarity, size = 72, locked = false }: { theme: CollectibleTheme; rarity: Rarity; size?: number; locked?: boolean }) {
  const ring = locked ? colors.paperEdge : RARITY_STYLE[rarity].ring;
  const base = locked ? colors.paperDeep : THEME_STYLE[theme].base;
  const accent = THEME_STYLE[theme].accent;
  // Scalloped badge edge (12 bumps) gives it a stamped-souvenir silhouette.
  const bumps = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: 32 + Math.cos(a) * 26, y: 32 + Math.sin(a) * 26 };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={33} cy={34} r={29} fill={colors.ink} opacity={0.18} />
      {bumps.map((b, i) => (
        <Circle key={i} cx={b.x} cy={b.y} r={6} fill={ring} stroke={colors.ink} strokeWidth={2} />
      ))}
      <Circle cx={32} cy={32} r={26} fill={ring} />
      <Circle cx={32} cy={32} r={22} fill={base} stroke={colors.ink} strokeWidth={2.5} />
      {locked ? (
        <G opacity={0.55}>
          <Rect x={23} y={30} width={18} height={14} rx={3} fill={colors.inkFaint} stroke={colors.ink} strokeWidth={2} />
          <Path d="M26 30 L26 25 C26 21 29 19 32 19 C35 19 38 21 38 25 L38 30" stroke={colors.ink} strokeWidth={2.5} fill="none" />
        </G>
      ) : (
        <G transform="translate(6.4 6.4) scale(0.8)">
          <Motif theme={theme} ink={colors.ink} accent={accent} />
        </G>
      )}
      {!locked && <Path d="M18 20 C21 15 26 12 31 11" stroke={colors.white} strokeWidth={2.5} strokeLinecap="round" opacity={0.7} fill="none" />}
    </Svg>
  );
}
