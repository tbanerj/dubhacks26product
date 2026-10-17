import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptics are decoration: they must never be able to break a tap handler.
 * (On web the native module is unavailable and can throw synchronously.)
 */
function safe(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  try {
    void fn().catch(() => undefined);
  } catch {
    // ignore
  }
}

export const haptic = {
  tap: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
