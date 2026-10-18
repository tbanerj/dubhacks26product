/**
 * Central configuration. This is the ONLY place that reads environment variables.
 *
 * Expo inlines `EXPO_PUBLIC_*` values into the JS bundle at build time, so none of
 * these are secret once shipped. They are acceptable for a local demo build; for
 * production, Gemini calls should go through a backend proxy that holds the real
 * key (see README "Production notes").
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

/** Accepts the project URL with or without a trailing /rest/v1 or slash. */
function readSupabaseUrl(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(v)) return null;
  return v.replace(/\/(rest|auth)\/v1\/?$/i, '').replace(/\/+$/, '');
}

// Each variable is referenced literally so Expo's babel transform can inline it.
export const config = {
  gemini: {
    apiKey: readKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
    model: process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  photon: {
    relayUrl: readKey(process.env.EXPO_PUBLIC_PHOTON_RELAY_URL),
    apiUrl: readKey(process.env.EXPO_PUBLIC_PHOTON_API_URL),
  },
  supabase: {
    url: readSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL),
    // Publishable key (sb_publishable_…): safe in the client; Row Level Security protects data.
    publishableKey: readKey(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  },
  places: {
    overpassUrl: readUrl(process.env.EXPO_PUBLIC_OVERPASS_URL, 'https://overpass-api.de/api/interpreter'),
  },
} as const;

export type IntegrationStatus = 'live' | 'demo';

export function isSupabaseConfigured(): boolean {
  return config.supabase.url !== null && config.supabase.publishableKey !== null;
}

export function integrationStatus(): Record<'gemini' | 'photon' | 'supabase', IntegrationStatus> {
  return {
    gemini: config.gemini.apiKey ? 'live' : 'demo',
    photon: config.photon.apiUrl || config.photon.relayUrl ? 'live' : 'demo',
    supabase: isSupabaseConfigured() ? 'live' : 'demo',
  };
}
