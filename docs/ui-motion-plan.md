# Thaw UI motion

## Navigation

Custom tab bar on the existing `@react-navigation/bottom-tabs` navigator (`createBottomTabNavigator` in `thaw/src/navigation/RootNavigator.tsx`). The selected tab is `state.index` from that navigator. The bar does not keep a second selected-tab store.

Native bottom tabs were not used. This app is Expo SDK 57 with `react-native-screens` 4.26 and no Expo Router. React Navigation’s native bottom tab navigator needs `react-native-screens` 4.30 or newer, is iOS and Android only, and does not expose a commit-on-release scrub. A gesture layered on `UITabBar` would compete with the system control.

The sliding gesture lives only on the tab row. It uses measured `onLayout` frames (`thaw/src/navigation/tabSlide.ts`). The indicator follows the finger with `Animated`. Navigation runs once on release over a tab. A release or cancel outside the bar springs the indicator back to the active route. Taps still select a tab. Screen readers use the tab buttons; they do not need the pan.

Full-screen paging is not part of this pass. The map, quest sheet, lists, and camera each own their own gestures. Party, Collection, and You could be revisited later; Explore should not be placed in a horizontal pager.

## Skill files

Guidance came from `thaw/.agents/skills/apple-design/`:

- `SKILL.md`
- `references/materials-color.md`
- `references/patterns-gestures.md`
- `references/components.md`
- `references/layout.md`
- `references/accessibility.md`
- `references/typography-symbols.md`

Implementation APIs were checked against Expo SDK 57 `expo-glass-effect` 57.0.4 (`GlassView`, `isLiquidGlassAvailable`, `isGlassEffectAPIAvailable`) and React Navigation 7.21.

## Glass

`GlassSurface` renders `GlassView` only on iOS when both availability checks pass and Reduce Transparency is off. The glass is untinted `regular` (or `clear` if a caller asks). `colorScheme` follows the app theme. Opacity on `GlassView` is not animated.

Everywhere else, including Android, web, older iOS, and Reduce Transparency, the control is an opaque `colors.surface` with a hairline border.

Glass is used for the tab bar, the Explore location chip and avatar, map tool buttons, and the photo close button. Quest copy, settings, chat, and the collectible grid stay solid.

`expo-glass-effect` is already a dependency of this Expo 57 app, including Expo Go 57. These changes do not add a native module, so they do not require a new native rebuild. Liquid Glass itself still appears only on iOS 26 and later when the API is available.

## Motion presets

`thaw/src/theme/motion.ts`, using React Native `Animated` friction/tension springs (not Reanimated):

- Press: 140ms
- Selection and small fades: 200ms
- Sheet and larger layout: 300ms
- Map camera: 320ms
- Springs: friction 12, tension 90

Reduce Motion sets values immediately and skips selection haptics and confetti. The indicator and sheet stop the in-flight animation when a new gesture starts.

Tab scenes use the navigator’s own switch. They are not wrapped in a pager. `freezeOnBlur` keeps visited screens mounted and pauses offscreen renders. Party subscriptions stay in the store, so a tab change does not reconnect chat.

## Gesture ownership

- Tab row: tap and horizontal slide to change tabs
- Map: pan, pinch, and long-press stay on `MapView`. A user pan interrupts `animateCamera`
- Quest sheet: vertical drag on the handle only
- Quest list and other vertical scrolls: their own scroll views
- Collection theme chips: their own horizontal scroll
- Photo controls: taps on the camera screen
- Chat composer: `KeyboardAvoidingView` on the chat screen
- Pushed screens: native stack back gesture, except Reward, which disables it so a reward is not dismissed by accident

## Checks and limits

Unit tests cover hit testing, RTL frames, hysteresis, cancellation, and haptic deduplication (`thaw/__tests__/tabSlide.test.ts`).

Not measured here: frame rate on a device, iOS 26 Liquid Glass rendering, system Reduce Transparency, and selection haptics. Those need a simulator or device on iOS 26. Web uses the opaque fallback.
