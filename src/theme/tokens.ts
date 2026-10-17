import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** Thaw palette: warm paper, forest, grass, sunset, butter. No purple gradients. */
export const colors = {
  paper: '#FFF7E8',
  paperDeep: '#F6EBD3',
  paperEdge: '#E9D9B8',
  forest: '#285943',
  forestDeep: '#1B3E2F',
  grass: '#8BBF65',
  grassSoft: '#D7EBC4',
  sunset: '#F28B50',
  sunsetDeep: '#C9622A',
  sunsetSoft: '#FCDCC5',
  butter: '#F6D66B',
  butterSoft: '#FBEDB8',
  ink: '#30372D',
  inkSoft: '#5E6656',
  inkFaint: '#8E927F',
  clay: '#B9694A',
  moss: '#6F8A4E',
  sky: '#7FB3B0',
  skySoft: '#D4E8E5',
  berry: '#B4475B',
  white: '#FFFFFF',
  danger: '#B4475B',
  dangerSoft: '#F5D5D9',
} as const;

export type ColorName = keyof typeof colors;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  displayMedium: 'Fredoka_500Medium',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
} as const;

/** Type scale. All sizes respect the OS text-size setting (allowFontScaling is on by default). */
export const type = {
  hero: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 38, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  subheading: { fontFamily: fonts.displayMedium, fontSize: 16, lineHeight: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17, color: colors.inkSoft },
  tiny: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: colors.inkSoft, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

/**
 * "Paper cutout" shadow: a hard, offset, un-blurred shadow reads as layered paper
 * rather than floating glass. Android elevation can't do hard offsets, so cards also
 * draw a darker bottom border (see `paperEdge`).
 */
export function cutout(depth: 2 | 4 | 6 = 4, tint: string = colors.ink): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: tint, shadowOpacity: 0.18, shadowRadius: 0, shadowOffset: { width: 0, height: depth } },
    android: { elevation: depth },
    default: { shadowColor: tint, shadowOpacity: 0.18, shadowRadius: 0, shadowOffset: { width: 0, height: depth } },
  }) as ViewStyle;
}

export const paperEdge: ViewStyle = {
  borderWidth: 2,
  borderColor: colors.ink,
  borderBottomWidth: 4,
};

/** Minimum touch target per platform accessibility guidance. */
export const TOUCH = 44;
