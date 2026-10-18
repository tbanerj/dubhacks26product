/**
 * Place discovery. Provider abstraction with an OpenStreetMap (Overpass API)
 * implementation and seeded/sample fallbacks. Data © OpenStreetMap contributors (ODbL).
 */
import { z } from 'zod';
import type { Landmark, LandmarkCategory, LatLng } from '../types';
import { config } from '../config/env';
import { coarseKey, distanceMeters, isValidCoordinate } from '../game/geo';
import { cacheGet, cacheGetStale, cacheSet } from './storage';
import { clampText } from '../utils/format';

export interface PlacesProvider {
  readonly name: string;
  findNearby(center: LatLng, radiusM: number, signal?: AbortSignal): Promise<Landmark[]>;
}

export type PlacesResult =
  | { ok: true; landmarks: Landmark[]; provider: string; cached: boolean }
  | { ok: false; reason: string };

const OverpassElement = z.object({
  type: z.string(),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});
const OverpassResponse = z.object({ elements: z.array(z.unknown()) });

function categorise(tags: Record<string, string>): LandmarkCategory | null {
  if (tags.access === 'private' || tags.access === 'no') return null;
  const leisure = tags.leisure;
  const amenity = tags.amenity;
  const tourism = tags.tourism;
  if (leisure === 'garden') return 'garden';
  if (leisure === 'park') return 'park';
  if (amenity === 'library') return 'library';
  if (amenity === 'marketplace') return 'market';
  if (amenity === 'fountain') return 'fountain';
  if (tourism === 'museum') return 'museum';
  if (tourism === 'artwork') return 'artwork';
  if (tourism === 'viewpoint') return 'viewpoint';
  if (tags.place === 'square') return 'plaza';
  if (tags.historic) return 'historic';
  if (tourism === 'attraction') return 'historic';
  return null;
}

function buildQuery(c: LatLng, r: number): string {
  const a = `(around:${Math.round(r)},${c.latitude.toFixed(5)},${c.longitude.toFixed(5)})`;
  return `[out:json][timeout:12];(
nwr["leisure"~"^(park|garden)$"]["name"]${a};
nwr["amenity"~"^(library|marketplace|fountain)$"]["name"]${a};
nwr["tourism"~"^(museum|artwork|viewpoint|attraction)$"]["name"]${a};
nwr["historic"]["name"]${a};
nwr["place"="square"]["name"]${a};
);out center 80;`;
}

/**
 * Public Overpass instances. The default overpass-api.de endpoint often accepts
 * a connection and then sends nothing, and the older mirrors were returning 500s.
 * A known-healthy instance goes first. Each attempt has its own short timeout so
 * one hung server cannot cancel the rest.
 */
const OVERPASS_MIRRORS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const PER_ENDPOINT_MS = 6_000;
const TOTAL_PLACES_MS = 14_000;
const inflight = new Map<string, Promise<Landmark[]>>();

function endpointList(): string[] {
  return [...new Set([OVERPASS_MIRRORS[0]!, config.places.overpassUrl, ...OVERPASS_MIRRORS])];
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message));
}

function landmarksFromElements(elements: unknown[], center: LatLng): Landmark[] {
  const seenNames = new Set<string>();
  const out: Landmark[] = [];
  for (const raw of elements) {
    const el = OverpassElement.safeParse(raw);
    if (!el.success) continue;
    const tags = el.data.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    const category = categorise(tags);
    if (!category) continue;
    const lat = el.data.lat ?? el.data.center?.lat;
    const lon = el.data.lon ?? el.data.center?.lon;
    const coordinate = { latitude: lat ?? NaN, longitude: lon ?? NaN };
    if (!isValidCoordinate(coordinate)) continue;
    const dedupe = name.toLocaleLowerCase();
    if (seenNames.has(dedupe)) continue;
    seenNames.add(dedupe);
    out.push({
      id: `osm-${el.data.type[0]}${el.data.id}`,
      name: clampText(name, 48),
      category,
      coordinate,
      source: 'openstreetmap',
    });
  }
  out.sort((x, y) => distanceMeters(center, x.coordinate) - distanceMeters(center, y.coordinate));
  return out.slice(0, 14);
}

export const overpassProvider: PlacesProvider = {
  name: 'OpenStreetMap',
  async findNearby(center, radiusM, signal) {
    const key = `${coarseKey(center, 3)}:${radiusM}`;
    const existing = inflight.get(key);
    if (existing) return existing;

    const run = (async () => {
      const body = `data=${encodeURIComponent(buildQuery(center, radiusM))}`;
      const started = Date.now();
      let empty: Landmark[] | null = null;
      let lastErr: Error = new Error('Map data unavailable.');
      for (const url of endpointList()) {
        if (signal?.aborted) break;
        const remaining = TOTAL_PLACES_MS - (Date.now() - started);
        if (remaining < 800) break;
        const attempt = new AbortController();
        const onAbort = () => attempt.abort();
        signal?.addEventListener('abort', onAbort);
        const timer = setTimeout(() => attempt.abort(), Math.min(PER_ENDPOINT_MS, remaining));
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body,
            signal: attempt.signal,
          });
          if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
          const parsed = OverpassResponse.parse(await res.json());
          const found = landmarksFromElements(parsed.elements, center);
          // An empty 200 can be a broken replica. Keep looking for a server that knows this city.
          if (found.length > 0) return found;
          empty = found;
        } catch (e) {
          if (signal?.aborted) break;
          lastErr = isAbort(e) ? new Error('Map data took too long to load.') : e instanceof Error ? e : lastErr;
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
        }
      }
      if (empty) return empty;
      throw lastErr;
    })();

    inflight.set(key, run);
    try {
      return await run;
    } finally {
      inflight.delete(key);
    }
  },
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface DiscoverOptions {
  provider?: PlacesProvider;
  /** Skip the fresh cache and ask the network again. A failed refresh still uses the last saved places. */
  force?: boolean;
}

/** Find places near a coordinate with caching and a hard timeout. Never throws. */
export async function discoverPlaces(center: LatLng, radiusM = 1_500, opts: DiscoverOptions = {}): Promise<PlacesResult> {
  const provider = opts.provider ?? overpassProvider;
  const cacheKey = `places:${provider.name}:${coarseKey(center, 3)}:${radiusM}`;
  if (!opts.force) {
    const cached = await cacheGet<Landmark[]>(cacheKey, CACHE_TTL_MS);
    if (cached?.length) return { ok: true, landmarks: cached, provider: provider.name, cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_PLACES_MS + 1_000);
  try {
    const landmarks = await provider.findNearby(center, radiusM, controller.signal);
    if (landmarks.length > 0) await cacheSet(cacheKey, landmarks);
    return { ok: true, landmarks, provider: provider.name, cached: false };
  } catch (e) {
    const stale = await cacheGetStale<Landmark[]>(cacheKey);
    if (stale?.length) return { ok: true, landmarks: stale, provider: provider.name, cached: true };
    const reason = controller.signal.aborted ? 'Map data took too long to load.' : e instanceof Error ? e.message : 'Map data unavailable.';
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
