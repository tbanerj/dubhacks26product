import AsyncStorage from '@react-native-async-storage/async-storage';
import { discoverPlaces } from '../src/services/places';
import { coarseKey } from '../src/game/geo';

const center = { latitude: 47.661, longitude: -122.304 };
const park = {
  type: 'node',
  id: 42,
  lat: 47.66,
  lon: -122.303,
  tags: { name: 'Ravenna Park', leisure: 'park' },
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('place discovery', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('skips a dead Overpass server and uses the next one', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, false, 503);
      return jsonResponse({ elements: [park] });
    }) as never;

    const res = await discoverPlaces({ ...center, latitude: 47.662 }, 1_500, { force: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.landmarks.map((l) => l.name)).toContain('Ravenna Park');
      expect(res.cached).toBe(false);
    }
    expect(calls).toBe(2);
  });

  it('keeps looking when a server answers with no places', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ elements: [] });
      return jsonResponse({ elements: [park] });
    }) as never;

    const res = await discoverPlaces({ ...center, latitude: 47.663 }, 1_500, { force: true });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.landmarks[0]?.name).toBe('Ravenna Park');
    expect(calls).toBe(2);
  });

  it('uses the last saved places when every server fails', async () => {
    const spot = { latitude: 47.664, longitude: -122.304 };
    const key = `thaw-cache:places:OpenStreetMap:${coarseKey(spot, 3)}:1500`;
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        at: Date.now() - 48 * 60 * 60 * 1000,
        value: [{ id: 'osm-n1', name: 'Cowen Park', category: 'park', coordinate: spot, source: 'openstreetmap' }],
      }),
    );
    global.fetch = jest.fn(async () => jsonResponse({}, false, 500)) as never;

    const res = await discoverPlaces(spot, 1_500, { force: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.cached).toBe(true);
      expect(res.landmarks[0]?.name).toBe('Cowen Park');
    }
  });
});
