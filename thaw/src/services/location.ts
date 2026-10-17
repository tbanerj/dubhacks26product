import * as Location from 'expo-location';
import type { LatLng } from '../types';
import { isValidCoordinate } from '../game/geo';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown';
  } catch {
    return 'unavailable';
  }
}

/** Foreground-only. We never ask for background location. */
export async function requestPermission(): Promise<PermissionState> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export type FixResult = { ok: true; coordinate: LatLng; accuracyM: number | null } | { ok: false; reason: string };

/**
 * Get one position fix. Uses Balanced accuracy (≈100 m) – enough to find nearby
 * landmarks; we don't need precise location to play. Times out gracefully, which
 * matters on simulators that never produce a fix.
 */
export async function getCurrentFix(timeoutMs = 10_000): Promise<FixResult> {
  try {
    const services = await Location.hasServicesEnabledAsync();
    if (!services) return { ok: false, reason: 'Location services are turned off.' };

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);
    if (!fix) {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      if (last && isValidCoordinate(last.coords)) {
        return { ok: true, coordinate: { latitude: last.coords.latitude, longitude: last.coords.longitude }, accuracyM: last.coords.accuracy };
      }
      return { ok: false, reason: 'Couldn’t get a location fix in time.' };
    }
    const c = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
    if (!isValidCoordinate(c)) return { ok: false, reason: 'Received an invalid location.' };
    return { ok: true, coordinate: c, accuracyM: fix.coords.accuracy };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Location unavailable.' };
  }
}

/** Subscribe to coarse position updates while the map is open. Returns an unsubscribe fn. */
export async function watchPosition(onUpdate: (c: LatLng) => void): Promise<() => void> {
  try {
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 10_000 },
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        if (isValidCoordinate(c)) onUpdate(c);
      },
    );
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}
