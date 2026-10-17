import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Semantic palette. Legacy names (paper, ink, forest, …) stay so existing
 * call sites keep compiling while screens move onto `useTheme()`.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  text: string;
  textSecondary: string;
  textFaint: string;
  sage: string;
  sageSoft: string;
  amber: string;
  amberSoft: string;
  border: string;
  danger: string;
  dangerSoft: string;
  white: string;
  paper: string;
  paperDeep: string;
  paperEdge: string;
  forest: string;
  forestDeep: string;
  grass: string;
  grassSoft: string;
  sunset: string;
  sunsetDeep: string;
  sunsetSoft: string;
  butter: string;
  butterSoft: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  clay: string;
  moss: string;
  sky: string;
  skySoft: string;
  berry: string;
}

export const lightColors: Palette = {
  bg: '#F8F8F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F1EA',
  primary: '#245C46',
  primaryPressed: '#1B4636',
  onPrimary: '#F7F7F2',
  text: '#1C2420',
  textSecondary: '#5C675F',
  textFaint: '#8A9188',
  sage: '#7D9A84',
  sageSoft: '#E4EFE6',
  amber: '#C9843A',
  amberSoft: '#F8EBD6',
  border: '#E4E2D8',
  danger: '#9C3D4A',
  dangerSoft: '#F6E4E6',
  white: '#FFFFFF',
  paper: '#F8F8F3',
  paperDeep: '#F1F1EA',
  paperEdge: '#E4E2D8',
  forest: '#245C46',
  forestDeep: '#1B4636',
  grass: '#6E9474',
  grassSoft: '#E4EFE6',
  sunset: '#C9843A',
  sunsetDeep: '#A86A28',
  sunsetSoft: '#F8EBD6',
  butter: '#E7C56A',
  butterSoft: '#F8F1D4',
  ink: '#1C2420',
  inkSoft: '#5C675F',
  inkFaint: '#8A9188',
  clay: '#A56B4A',
  moss: '#6E9474',
  sky: '#6F9E9A',
  skySoft: '#E3F0EE',
  berry: '#9C3D4A',
};

export const darkColors: Palette = {
  bg: '#121815',
  surface: '#1C2420',
  surfaceMuted: '#242C28',
  primary: '#3F8F6E',
  primaryPressed: '#2F6E54',
  onPrimary: '#F4F3EC',
  text: '#F4F3EC',
  textSecondary: '#C5CDC6',
  textFaint: '#8E9890',
  sage: '#8FB39A',
  sageSoft: '#24352C',
  amber: '#E0A15A',
  amberSoft: '#3A2E22',
  border: '#313A34',
  danger: '#E08A94',
  dangerSoft: '#3A2428',
  white: '#1C2420',
  paper: '#121815',
  paperDeep: '#242C28',
  paperEdge: '#313A34',
  forest: '#3F8F6E',
  forestDeep: '#2F6E54',
  grass: '#8FB39A',
  grassSoft: '#24352C',
  sunset: '#E0A15A',
  sunsetDeep: '#C9843A',
  sunsetSoft: '#3A2E22',
  butter: '#E0A15A',
  butterSoft: '#3A2E22',
  ink: '#F4F3EC',
  inkSoft: '#C5CDC6',
  inkFaint: '#8E9890',
  clay: '#D09A74',
  moss: '#8FB39A',
  sky: '#8FBFBB',
  skySoft: '#1E2E2C',
  berry: '#E08A94',
};

/** Light palette for modules that cannot call `useTheme()`. */
export const colors = lightColors;

export type ColorName = keyof Palette;

export const spacing = { xxs: 4, xs: 8, sm: 8, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48, screen: 20 } as const;

export const radii = { sm: 8, md: 12, lg: 20, xl: 24, pill: 999 } as const;

/** System fonts. Weight is set on the type scale so Dynamic Type keeps working. */
export const fonts = {
  display: undefined,
  displayBold: undefined,
  displayMedium: undefined,
  body: undefined,
  bodySemi: undefined,
  bodyBold: undefined,
} as const;

export function makeType(c: Pick<Palette, 'text' | 'textSecondary'>): Record<'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'small' | 'tiny', TextStyle> {
  return {
    hero: { fontSize: 32, lineHeight: 38, fontWeight: '700', color: c.text },
    title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: c.text },
    heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: c.text },
    subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: c.text },
    body: { fontSize: 16, lineHeight: 22, fontWeight: '400', color: c.text },
    bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: c.text },
    small: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: c.textSecondary },
    tiny: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.2 },
  };
}

/** Type scale. Sizes respect the OS text-size setting (`allowFontScaling` stays on). */
export const type = makeType(lightColors);

/** Soft elevation. Replaces the old hard paper-cutout shadow. */
export function cutout(_depth: 2 | 4 | 6 = 4, _tint: string = colors.text): ViewStyle {
  return softShadow;
}

export const softShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#1C2420', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: { shadowColor: '#1C2420', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
}) as ViewStyle;

export const paperEdge: ViewStyle = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
};

/** Minimum touch target. */
export const TOUCH = 44;

export type AppearancePreference = 'system' | 'light' | 'dark';
