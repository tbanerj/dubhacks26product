/**
 * Warm "paper atlas" style for Google Maps (Android, and iOS when using the Google
 * provider). Built-in POIs are hidden so Thaw's own hubs carry the story.
 * Apple Maps (iOS default in Expo Go) ignores this; there we use `mutedStandard`.
 */
export const PAPER_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#e7efe6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5c675f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f8f3' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9b48c' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#efe0c3' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eadcbc' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c9e0ad' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#fffaf0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2cfa8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fbe3b0' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e8c27a' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ saturation: -60 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a9d3cf' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3f6f6b' }] },
];
