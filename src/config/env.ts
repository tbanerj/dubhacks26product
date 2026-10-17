/**
 * Central configuration. This is the ONLY place that reads environment variables.
 *
 * Expo inlines `EXPO_PUBLIC_*` values into the JS bundle at build time, so none of
 * these are secret once shipped. They are acceptable for a local demo build; for
 * production, Gemini and Perceptron calls should go through a backend proxy that
 * holds the real keys (see README "Production notes").
 */

const PLACEHOLDER_PATTERN = /^YOUR_.*_HERE$/;

function readKey(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || PLACEHOLDER_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function readUrl(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v && /^https?:\/\//.test(v) ? v.replace(/\/+$/, '') : fallback;
}

// Each variable is referenced literally so Expo's babel transform can inline it.
export const config = {
  gemini: {
    apiKey: readKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
    model: process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  perceptron: {
    apiKey: readKey(process.env.EXPO_PUBLIC_PERCEPTRON_API_KEY),
    baseUrl: readUrl(process.env.EXPO_PUBLIC_PERCEPTRON_BASE_URL, 'https://api.perceptron.inc/v1'),
    model: process.env.EXPO_PUBLIC_PERCEPTRON_MODEL?.trim() || 'perceptron-mk1.5',
  },
  photon: {
    relayUrl: readKey(process.env.EXPO_PUBLIC_PHOTON_RELAY_URL),
  },
  places: {
    overpassUrl: readUrl(process.env.EXPO_PUBLIC_OVERPASS_URL, 'https://overpass-api.de/api/interpreter'),
  },
} as const;

export type IntegrationStatus = 'live' | 'demo';

export function integrationStatus(): Record<'gemini' | 'perceptron' | 'photon', IntegrationStatus> {
  return {
    gemini: config.gemini.apiKey ? 'live' : 'demo',
    perceptron: config.perceptron.apiKey ? 'live' : 'demo',
    photon: config.photon.relayUrl ? 'live' : 'demo',
  };
}
