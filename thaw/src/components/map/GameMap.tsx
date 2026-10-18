import React, { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { GameMapProps, MapHub } from './types';
import { HUB_LABEL, HubMarker, PlayerMarker } from '../Markers';
import { PAPER_MAP_STYLE } from './mapStyle';
import { CATEGORY_STYLE } from '../../theme/palette';
import { CHECK_IN_RADIUS_M } from '../../game/geo';
import { colors } from '../../theme/tokens';
import { motion } from '../../theme/motion';

const PITCH = 40;
const ZOOM = 15.2;
const ALTITUDE = 1800; // Apple Maps uses altitude instead of zoom.

/**
 * Custom marker views must re-render once after mount (fonts/icons) and then stop
 * tracking view changes, otherwise Android re-rasterises them every frame.
 */
function useSettledTracking(deps: unknown[]): boolean {
  const key = JSON.stringify(deps);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSettledKey(key), 700);
    return () => clearTimeout(t);
  }, [key]);
  return settledKey !== key;
}

const HubPin = memo(function HubPin({ hub, selected, onSelect }: { hub: MapHub; selected: boolean; onSelect: (id: string) => void }) {
  const tracking = useSettledTracking([hub.state, selected]);
  return (
    <Marker
      identifier={hub.landmark.id}
      coordinate={hub.landmark.coordinate}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracking}
      zIndex={selected ? 10 : hub.state === 'active' ? 8 : hub.state === 'completed' ? 1 : 5}
      onPress={() => onSelect(hub.landmark.id)}
      accessibilityLabel={`${hub.landmark.name}, ${CATEGORY_STYLE[hub.landmark.category].label}, ${HUB_LABEL[hub.state]}`}
    >
      <HubMarker category={hub.landmark.category} state={hub.state} selected={selected} />
    </Marker>
  );
});

function GameMapImpl({ player, hubs, selectedId, onSelectHub, onLongPress, onMapPress, recenterToken, focus }: GameMapProps) {
  const ref = useRef<MapView>(null);
  const playerTracking = useSettledTracking([player.hue, player.label]);

  const flyTo = (center: { latitude: number; longitude: number }) => {
    ref.current?.animateCamera({ center, pitch: PITCH, heading: 0, zoom: ZOOM, altitude: ALTITUDE }, { duration: motion.map });
  };

  useEffect(() => {
    if (recenterToken > 0) flyTo(player.coordinate);
    // Only recenter on explicit request, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterToken]);

  useEffect(() => {
    if (focus) flyTo(focus.coordinate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.token]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialCamera={{ center: player.coordinate, pitch: PITCH, heading: 0, zoom: ZOOM, altitude: ALTITUDE }}
      customMapStyle={PAPER_MAP_STYLE}
      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      showsPointsOfInterests={false}
      showsBuildings
      pitchEnabled
      showsCompass={false}
      toolbarEnabled={false}
      onPress={onMapPress ? (e) => onMapPress(e.nativeEvent.coordinate) : undefined}
      onLongPress={onLongPress ? (e) => onLongPress(e.nativeEvent.coordinate) : undefined}
      accessibilityLabel="Quest map"
    >
      {hubs.map((h) => (
        <HubPin key={h.landmark.id} hub={h} selected={h.landmark.id === selectedId} onSelect={onSelectHub} />
      ))}
      {selectedId &&
        hubs
          .filter((h) => h.landmark.id === selectedId)
          .map((h) => (
            <Circle
              key={`r-${h.landmark.id}`}
              center={h.landmark.coordinate}
              radius={CHECK_IN_RADIUS_M}
              strokeColor={colors.sunsetDeep}
              strokeWidth={2}
              fillColor="rgba(242,139,80,0.12)"
            />
          ))}
      <Marker
        coordinate={player.coordinate}
        anchor={{ x: 0.5, y: 0.6 }}
        tracksViewChanges={playerTracking}
        zIndex={20}
        accessibilityLabel={`You: ${player.label}`}
      >
        <PlayerMarker hue={player.hue} label={player.label} />
      </Marker>
    </MapView>
  );
}

export const GameMap = memo(GameMapImpl);
