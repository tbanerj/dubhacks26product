/**
 * Place discovery. Provider abstraction with an OpenStreetMap (Overpass API)
 * implementation and seeded/sample fallbacks. Data © OpenStreetMap contributors (ODbL).
 */
import { z } from 'zod';
import type { Landmark, LandmarkCategory, LatLng } from '../types';
import { config } from '../config/env';
import { coarseKey, distanceMeters, isValidCoordinate } from '../game/geo';
import { cacheGet, cacheSet } from './storage';
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

/** Overpass is a shared public service: be polite – cache, dedupe, and space out calls. */
const MIN_INTERVAL_MS = 4_000;
const OVERPASS_MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let lastRequestAt = 0;
const inflight = new Map<string, Promise<Landmark[]>>();

export const overpassProvider: PlacesProvider = {
  name: 'OpenStreetMap',
  async findNearby(center, radiusM, signal) {
    const key = `${coarseKey(center, 3)}:${radiusM}`;
    const existing = inflight.get(key);
    if (existing) return existing;

    const run = (async () => {
      const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastRequestAt = Date.now();

      // Try the configured endpoint, then public mirrors (Overpass instances are often busy).
      const endpoints = [...new Set([config.places.overpassUrl, ...OVERPASS_MIRRORS])];
      let json: unknown = null;
      let lastErr: Error = new Error('Map data unavailable.');
      for (const url of endpoints) {
        if (signal?.aborted) break;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: `data=${encodeURIComponent(buildQuery(center, radiusM))}`,
            signal,
          });
          if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
          json = await res.json();
          break;
        } catch (e) {
          lastErr = e instanceof Error ? e : lastErr;
        }
      }
      if (json === null) throw lastErr;
      const parsed = OverpassResponse.parse(json);

      const seenNames = new Set<string>();
      const out: Landmark[] = [];
      for (const raw of parsed.elements) {
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
      // Favour variety: closest first, then cap so the map stays readable.
      out.sort((x, y) => distanceMeters(center, x.coordinate) - distanceMeters(center, y.coordinate));
      return out.slice(0, 14);
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

/** Find places near a coordinate with caching and a hard timeout. Never throws. */
export async function discoverPlaces(center: LatLng, radiusM = 1_500, provider: PlacesProvider = overpassProvider): Promise<PlacesResult> {
  const cacheKey = `places:${provider.name}:${coarseKey(center, 3)}:${radiusM}`;
  const cached = await cacheGet<Landmark[]>(cacheKey, CACHE_TTL_MS);
  if (cached) return { ok: true, landmarks: cached, provider: provider.name, cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const landmarks = await provider.findNearby(center, radiusM, controller.signal);
    if (landmarks.length > 0) await cacheSet(cacheKey, landmarks);
    return { ok: true, landmarks, provider: provider.name, cached: false };
  } catch (e) {
    const reason = controller.signal.aborted ? 'Map data took too long to load.' : e instanceof Error ? e.message : 'Map data unavailable.';
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
