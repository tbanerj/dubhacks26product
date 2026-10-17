import { getLocales } from 'expo-localization';

export type UnitSystem = 'metric' | 'imperial';

/** Detect the device's preferred measurement system; defaults to metric. */
export function deviceUnitSystem(): UnitSystem {
  try {
    const sys = getLocales()[0]?.measurementSystem;
    return sys === 'us' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

export function deviceLocale(): string {
  try {
    return getLocales()[0]?.languageTag ?? 'en';
  } catch {
    return 'en';
  }
}

function numberFormat(locale: string, maxFractionDigits: number): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits });
  } catch {
    return new Intl.NumberFormat('en', { maximumFractionDigits: maxFractionDigits });
  }
}

export function formatDistance(meters: number, units: UnitSystem, locale = deviceLocale()): string {
  if (units === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 1000) return `${numberFormat(locale, 0).format(Math.round(feet / 10) * 10)} ft`;
    return `${numberFormat(locale, 1).format(meters / 1609.344)} mi`;
  }
  if (meters < 1000) return `${numberFormat(locale, 0).format(Math.round(meters / 10) * 10)} m`;
  return `${numberFormat(locale, 1).format(meters / 1000)} km`;
}

export function formatDate(iso: string, locale = deviceLocale()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return d.toDateString();
  }
}

export function formatTime(iso: string, locale = deviceLocale()): string {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
  } catch {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

export function formatNumber(n: number, locale = deviceLocale()): string {
  return numberFormat(locale, 0).format(n);
}

/** Unicode-safe initial (handles emoji, CJK, combining marks via code points). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '?';
}

/** Trim + clamp by code points (not UTF-16 units) so we never split a surrogate pair. */
export function clampText(text: string, maxChars: number): string {
  const chars = Array.from(text.trim());
  return chars.length <= maxChars ? chars.join('') : chars.slice(0, maxChars).join('');
}
