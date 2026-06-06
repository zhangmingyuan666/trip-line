import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { pointFeature, pointsFeatureCollection, routeFeature, toLngLat, type LngLat } from './mapUtils';
import type { PhotoPoint } from './types';
import { emptyLine, emptyPoints, setSourceData } from './footprintMapLayers';

export function syncMapData(map: MapLibreMap, photos: PhotoPoint[], currentIndex: number, shouldFitBounds: boolean) {
  if (!map.getSource('route-past')) return;

  const coordinates = photos.map(toLngLat);
  const visibleCoordinates = coordinates.slice(0, currentIndex + 1);
  setHoldingVisualState(map, photos, coordinates, currentIndex);

  if (!shouldFitBounds) {
    return;
  }

  if (visibleCoordinates.length === 1) {
    map.easeTo({ center: visibleCoordinates[0], zoom: 13, duration: 700 });
    return;
  }

  if (visibleCoordinates.length > 1) {
    const bounds = visibleCoordinates.reduce(
      (lngLatBounds, coordinate) => lngLatBounds.extend(coordinate),
      new maplibregl.LngLatBounds(visibleCoordinates[0], visibleCoordinates[0]),
    );

    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 160, left: 360 },
      duration: 900,
      maxZoom: 12,
    });
  }
}

export function setHoldingVisualState(
  map: MapLibreMap,
  photos: PhotoPoint[],
  coordinates: LngLat[],
  currentIndex: number,
) {
  const currentCoordinate = coordinates[currentIndex];
  const nextCoordinate = coordinates[currentIndex + 1];
  const pastCoordinates = coordinates.slice(0, currentIndex + 1);

  setSourceData(map, 'route-past', pastCoordinates.length > 1 ? routeFeature(pastCoordinates) : emptyLine);
  setSourceData(
    map,
    'route-upcoming',
    currentCoordinate && nextCoordinate ? routeFeature([currentCoordinate, nextCoordinate]) : emptyLine,
  );
  setSourceData(map, 'route-active', pastCoordinates.length > 1 ? routeFeature(pastCoordinates) : emptyLine);
  setSourceData(map, 'points-past', pointsFeatureCollection(photos.slice(0, currentIndex)));
  setSourceData(map, 'point-current', currentCoordinate ? pointFeature(currentCoordinate) : emptyPoints);
  setSourceData(map, 'point-upcoming', nextCoordinate ? pointFeature(nextCoordinate) : emptyPoints);
  setSourceData(map, 'point-moving', emptyPoints);
}

export function setMovingVisualState(
  map: MapLibreMap,
  photos: PhotoPoint[],
  coordinates: LngLat[],
  fromIndex: number,
) {
  const fromCoordinate = coordinates[fromIndex];
  const toCoordinate = coordinates[fromIndex + 1];
  const pastCoordinates = coordinates.slice(0, fromIndex + 1);

  setSourceData(map, 'route-past', pastCoordinates.length > 1 ? routeFeature(pastCoordinates) : emptyLine);
  setSourceData(
    map,
    'route-upcoming',
    fromCoordinate && toCoordinate ? routeFeature([fromCoordinate, toCoordinate]) : emptyLine,
  );
  setSourceData(map, 'route-active', pastCoordinates.length > 1 ? routeFeature(pastCoordinates) : emptyLine);
  setSourceData(map, 'points-past', pointsFeatureCollection(photos.slice(0, fromIndex + 1)));
  setSourceData(map, 'point-current', emptyPoints);
  setSourceData(map, 'point-upcoming', toCoordinate ? pointFeature(toCoordinate) : emptyPoints);
  setSourceData(map, 'point-moving', fromCoordinate ? pointFeature(fromCoordinate) : emptyPoints);
}
