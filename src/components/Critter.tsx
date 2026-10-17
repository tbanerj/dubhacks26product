import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { hueColor } from '../theme/palette';

/**
 * Thaw's player character: a round little sprout-sprite. Each player gets their
 * own body hue. Original artwork, drawn as SVG paths.
 */
export function Critter({ hue, size = 48, mood = 'happy' }: { hue: number; size?: number; mood?: 'happy' | 'wow' | 'sleepy' }) {
  const body = hueColor(hue, 64);
  const shade = hueColor(hue, 50);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* sprout */}
      <Path d="M32 16 C32 10 30 6 26 4" stroke={colors.forest} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M27 6 C20 2 14 6 15 11 C21 13 26 10 27 6 Z" fill={colors.grass} stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M31 9 C35 3 43 3 44 8 C40 13 34 13 31 9 Z" fill={colors.grass} stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" />
      {/* body */}
      <Ellipse cx={32} cy={58} rx={16} ry={3.5} fill={colors.ink} opacity={0.15} />
      <Path d="M10 38 C10 22 20 15 32 15 C44 15 54 22 54 38 C54 50 45 57 32 57 C19 57 10 50 10 38 Z" fill={body} stroke={colors.ink} strokeWidth={2.5} />
      <Path d="M14 44 C18 52 26 55 32 55 C40 55 47 51 50 44 C46 49 39 52 32 52 C25 52 18 49 14 44 Z" fill={shade} opacity={0.6} />
      {/* face */}
      <G>
        {mood === 'sleepy' ? (
          <>
            <Path d="M21 35 Q24 37 27 35" stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d="M37 35 Q40 37 43 35" stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Ellipse cx={24} cy={35} rx={3} ry={mood === 'wow' ? 4.2 : 3.6} fill={colors.ink} />
            <Ellipse cx={40} cy={35} rx={3} ry={mood === 'wow' ? 4.2 : 3.6} fill={colors.ink} />
            <Circle cx={25} cy={33.6} r={1.1} fill={colors.white} />
            <Circle cx={41} cy={33.6} r={1.1} fill={colors.white} />
          </>
        )}
        <Ellipse cx={18} cy={42} rx={3.6} ry={2.2} fill={colors.sunset} opacity={0.55} />
        <Ellipse cx={46} cy={42} rx={3.6} ry={2.2} fill={colors.sunset} opacity={0.55} />
        {mood === 'wow' ? (
          <Ellipse cx={32} cy={44} rx={3} ry={3.4} fill={colors.ink} />
        ) : (
          <Path d="M28 42 Q32 46 36 42" stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        )}
      </G>
    </Svg>
  );
}
