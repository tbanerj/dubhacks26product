/**
 * Demo regions for testing Thaw anywhere without GPS. These are sample datasets –
 * the live game discovers places from OpenStreetMap around any coordinate.
 * Coordinates are approximate public locations.
 */
import type { DemoRegion, Landmark, LandmarkCategory, LatLng } from '../types';
import { distanceMeters, offsetMeters } from '../game/geo';

export const GENERIC_REGION_ID = 'anywhere';

export const DEMO_REGIONS: DemoRegion[] = [
  { id: 'seattle', name: 'Seattle', country: 'United States', emoji: '🌲', center: { latitude: 47.6553, longitude: -122.3051 }, localeHint: 'en-US' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', emoji: '🏮', center: { latitude: 35.6702, longitude: 139.7027 }, localeHint: 'ja-JP' },
  { id: 'london', name: 'London', country: 'United Kingdom', emoji: '🎡', center: { latitude: 51.5117, longitude: -0.124 }, localeHint: 'en-GB' },
  { id: 'cdmx', name: 'Mexico City', country: 'Mexico', emoji: '🌵', center: { latitude: 19.4326, longitude: -99.1332 }, localeHint: 'es-MX' },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', emoji: '🌳', center: { latitude: -1.2864, longitude: 36.8172 }, localeHint: 'en-KE' },
  { id: 'saopaulo', name: 'São Paulo', country: 'Brazil', emoji: '🦜', center: { latitude: -23.5614, longitude: -46.6559 }, localeHint: 'pt-BR' },
  { id: GENERIC_REGION_ID, name: 'Anywhere', country: 'Sample spots around a point', emoji: '🧭', center: { latitude: 47.6553, longitude: -122.3051 }, localeHint: 'en' },
];

type SeedRow = [id: string, name: string, category: LandmarkCategory, lat: number, lng: number, blurb: string];

const SEEDS: Record<string, SeedRow[]> = {
  seattle: [
    ['sea-drumheller', 'Drumheller Fountain', 'fountain', 47.6537, -122.3078, 'Campus fountain with a view toward the mountains on clear days'],
    ['sea-suzzallo', 'Suzzallo Library', 'library', 47.6557, -122.308, 'Public university library with a famous reading room'],
    ['sea-quad', 'Liberal Arts Quad', 'plaza', 47.6575, -122.307, 'Brick-paved campus quad lined with trees'],
    ['sea-redsquare', 'Red Square', 'plaza', 47.6559, -122.3094, 'Open brick plaza at the heart of campus'],
    ['sea-burke', 'Burke Museum', 'museum', 47.6604, -122.3109, 'Natural history and culture museum'],
    ['sea-gasworks', 'Gas Works Park', 'park', 47.6456, -122.3344, 'Lakeside park built around old industrial towers'],
    ['sea-troll', 'Fremont Troll', 'artwork', 47.651, -122.3473, 'Giant public sculpture under a bridge'],
    ['sea-arboretum', 'Washington Park Arboretum', 'garden', 47.6398, -122.2945, 'Public arboretum with trails'],
  ],
  tokyo: [
    ['tyo-yoyogi', 'Yoyogi Park', 'park', 35.6717, 139.6949, 'Large public park with open lawns'],
    ['tyo-meiji', 'Meiji Jingu', 'shrine', 35.6764, 139.6993, 'Forested shrine grounds – visit respectfully'],
    ['tyo-takeshita', 'Takeshita Street', 'market', 35.6712, 139.7038, 'Busy pedestrian shopping street'],
    ['tyo-scramble', 'Shibuya Scramble', 'plaza', 35.6595, 139.7005, 'Famous pedestrian crossing'],
    ['tyo-hachiko', 'Hachikō Statue', 'artwork', 35.659, 139.7006, 'Bronze statue and popular meeting spot'],
  ],
  london: [
    ['lon-coventmkt', 'Covent Garden Market', 'market', 51.512, -0.1227, 'Historic covered market hall'],
    ['lon-trafalgar', 'Trafalgar Square', 'plaza', 51.508, -0.1281, 'Public square with fountains'],
    ['lon-natgallery', 'National Gallery', 'museum', 51.5089, -0.1283, 'Free public art museum'],
    ['lon-embankment', 'Victoria Embankment Gardens', 'garden', 51.5087, -0.1222, 'Riverside public gardens'],
    ['lon-sevendials', 'Seven Dials', 'historic', 51.5136, -0.1268, 'Junction of seven streets around a sundial pillar'],
  ],
  cdmx: [
    ['mex-zocalo', 'Zócalo', 'plaza', 19.4326, -99.1332, 'The main public square of the city'],
    ['mex-bellasartes', 'Palacio de Bellas Artes', 'museum', 19.4352, -99.1412, 'Cultural palace and museum'],
    ['mex-alameda', 'Alameda Central', 'park', 19.4357, -99.144, 'Historic public park with fountains'],
    ['mex-templomayor', 'Templo Mayor', 'historic', 19.4346, -99.1316, 'Archaeological site and museum'],
    ['mex-sanjuan', 'Mercado de San Juan', 'market', 19.431, -99.144, 'Public market hall'],
  ],
  nairobi: [
    ['nbo-uhuru', 'Uhuru Park', 'park', -1.2894, 36.8164, 'Public park beside the city centre'],
    ['nbo-archives', 'Kenya National Archives', 'historic', -1.2848, 36.8261, 'Historic archives building'],
    ['nbo-citymkt', 'City Market', 'market', -1.2828, 36.8195, 'Public market hall'],
    ['nbo-kicc', 'KICC', 'historic', -1.2887, 36.8233, 'Landmark convention centre architecture'],
    ['nbo-jeevanjee', 'Jeevanjee Gardens', 'garden', -1.2805, 36.82, 'Public gardens in the city centre'],
  ],
  saopaulo: [
    ['sao-trianon', 'Parque Trianon', 'park', -23.5617, -46.6574, 'Patch of Atlantic Forest on Avenida Paulista'],
    ['sao-masp', 'MASP', 'museum', -23.5614, -46.6558, 'Art museum with a famous open plaza beneath it'],
    ['sao-ibirapuera', 'Parque Ibirapuera', 'park', -23.5874, -46.6576, 'The city’s great public park'],
    ['sao-beco', 'Beco do Batman', 'artwork', -23.556, -46.687, 'Lane covered in street art'],
    ['sao-ccsp', 'Centro Cultural São Paulo', 'library', -23.5711, -46.6406, 'Public cultural centre with a library'],
  ],
};

export function seededLandmarks(regionId: string): Landmark[] {
  return (SEEDS[regionId] ?? []).map(([id, name, category, latitude, longitude, blurb]) => ({
    id,
    name,
    category,
    coordinate: { latitude, longitude },
    source: 'seed',
    blurb,
  }));
}

/**
 * "Anywhere" mode: clearly-labelled sample spots placed around any coordinate, for
 * places with sparse map data or when offline. These are NOT real mapped places.
 */
export function sampleSpotsAround(center: LatLng): Landmark[] {
  const spots: [string, LandmarkCategory, number, number][] = [
    ['Sample Park', 'park', 180, -120],
    ['Sample Library', 'library', -150, 200],
    ['Sample Square', 'plaza', 60, 260],
    ['Sample Mural', 'artwork', -260, -180],
    ['Sample Garden', 'garden', 340, 160],
  ];
  return spots.map(([name, category, n, e], i) => ({
    id: `sample-${i}-${center.latitude.toFixed(3)}-${center.longitude.toFixed(3)}`,
    name,
    category,
    coordinate: offsetMeters(center, n, e),
    source: 'seed',
    blurb: 'Sample spot for demo play – not a real mapped place',
  }));
}

export function regionById(id: string | null | undefined): DemoRegion | undefined {
  return DEMO_REGIONS.find((r) => r.id === id);
}

/** Closest curated city, or null when the player is outside every metro we ship. */
export function nearestRegion(center: LatLng, maxMeters = 40_000): DemoRegion | null {
  let best: DemoRegion | null = null;
  let bestD = maxMeters;
  for (const region of DEMO_REGIONS) {
    if (region.id === GENERIC_REGION_ID) continue;
    const d = distanceMeters(center, region.center);
    if (d <= bestD) {
      best = region;
      bestD = d;
    }
  }
  return best;
}
