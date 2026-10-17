import type { LatLng } from '../types';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Offset a coordinate by metres north/east. Accurate enough for city-scale offsets. */
export function offsetMeters(origin: LatLng, northM: number, eastM: number): LatLng {
  const dLat = northM / 111_320;
  const dLon = eastM / (111_320 * Math.max(0.01, Math.cos(toRad(origin.latitude))));
  return { latitude: origin.latitude + dLat, longitude: origin.longitude + dLon };
}

export function isValidCoordinate(c: LatLng | null | undefined): c is LatLng {
  return (
    !!c &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    Math.abs(c.latitude) <= 90 &&
    Math.abs(c.longitude) <= 180
  );
}

/** Players can check in once they're within this radius of a quest hub. */
export const CHECK_IN_RADIUS_M = 120;
/** Quests further than this from the player are not discoverable. */
export const DISCOVERY_RADIUS_M = 3_000;

/** Rounds a coordinate to roughly 100 m grid cells for caching and privacy. */
export function coarseKey(c: LatLng, decimals = 3): string {
  return `${c.latitude.toFixed(decimals)},${c.longitude.toFixed(decimals)}`;
}

/** Walking time estimate at a relaxed 4.5 km/h. */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 75));
}
