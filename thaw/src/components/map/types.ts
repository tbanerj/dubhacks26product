import type { Landmark, LatLng } from '../../types';
import type { HubState } from '../../game/questStatus';

export interface MapHub {
  landmark: Landmark;
  state: HubState;
}

export interface GameMapProps {
  player: { coordinate: LatLng; hue: number; label: string };
  hubs: MapHub[];
  selectedId: string | null;
  onSelectHub: (landmarkId: string) => void;
  onLongPress?: (c: LatLng) => void;
  /** A tap on the map itself, so a nearby event can be selected without leaving the map. */
  onMapPress?: (c: LatLng) => void;
  /** Increment to recenter the camera on the player. */
  recenterToken: number;
  /** Increment (with `focus`) to fly the camera to a coordinate. */
  focus?: { coordinate: LatLng; token: number } | null;
}
