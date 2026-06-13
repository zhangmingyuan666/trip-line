import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import {
  pointFeature,
  pointsFeatureCollection,
  routeCoordinatesForPhotos,
  routeFeature,
  routeSegmentCoordinates,
  toLngLat,
  type LngLat,
} from '../../core/map/geometry';
import type { MapTheme, PhotoPoint } from '../../core/photo/types';
import { emptyLine, emptyPoints, setFootprintLayerMode, setSourceData } from './layers';

export function syncMapData(
  map: MapLibreMap,
  photos: PhotoPoint[],
  currentIndex: number,
  shouldFitBounds: boolean,
  mapTheme: MapTheme,
): number {
  if (!map.getSource('route-past')) return 0;

  const coordinates = photos.map(toLngLat);
  const visibleCoordinates = coordinates.slice(0, currentIndex + 1);
  setHoldingVisualState(map, photos, coordinates, currentIndex, mapTheme);

  if (!shouldFitBounds) {
    return 0;
  }

  if (visibleCoordinates.length === 1) {
    const duration = 700;
    map.easeTo({ center: visibleCoordinates[0], zoom: 13, duration });
    return duration;
  }

  if (visibleCoordinates.length > 1) {
    const bounds = visibleCoordinates.reduce(
      (lngLatBounds, coordinate) => lngLatBounds.extend(coordinate),
      new maplibregl.LngLatBounds(visibleCoordinates[0], visibleCoordinates[0]),
    );

    const duration = 900;
    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 160, left: 360 },
      duration,
      maxZoom: 12,
    });
    return duration;
  }

  return 0;
}

export function setHoldingVisualState(
  map: MapLibreMap,
  photos: PhotoPoint[],
  coordinates: LngLat[],
  currentIndex: number,
  mapTheme: MapTheme,
) {
  const currentCoordinate = coordinates[currentIndex];
  const nextCoordinate = coordinates[currentIndex + 1];
  const pastCoordinates = routeCoordinatesForPhotos(photos, currentIndex);
  const upcomingCoordinates =
    currentCoordinate && nextCoordinate ? routeSegmentCoordinates(photos[currentIndex], photos[currentIndex + 1]) : [];

  setSourceData(map, 'route-past', pastCoordinates.length > 1 ? routeFeature(pastCoordinates) : emptyLine);
  setSourceData(
    map,
    'route-upcoming',
    upcomingCoordinates.length > 1 ? routeFeature(upcomingCoordinates) : emptyLine,
  );
  setSourceData(map, 'route-active', emptyLine);
  setSourceData(map, 'points-past', pointsFeatureCollection(photos.slice(0, currentIndex)));
  setSourceData(map, 'point-current', currentCoordinate ? pointFeature(currentCoordinate) : emptyPoints);
  setSourceData(map, 'point-upcoming', nextCoordinate ? pointFeature(nextCoordinate) : emptyPoints);
  setSourceData(map, 'point-moving', emptyPoints);
  setFootprintLayerMode(map, 'holding', mapTheme);
}

export function setMovingVisualState(
  map: MapLibreMap,
  photos: PhotoPoint[],
  coordinates: LngLat[],
  fromIndex: number,
  mapTheme: MapTheme,
) {
  const fromCoordinate = coordinates[fromIndex];
  const toCoordinate = coordinates[fromIndex + 1];
  const pastCoordinates = routeCoordinatesForPhotos(photos, fromIndex);
  const upcomingCoordinates =
    fromCoordinate && toCoordinate ? routeSegmentCoordinates(photos[fromIndex], photos[fromIndex + 1]) : [];

  setSourceData(map, 'route-past', pastCoordinates.length > 1 ? routeFeature(pastCoordinates) : emptyLine);
  setSourceData(
    map,
    'route-upcoming',
    upcomingCoordinates.length > 1 ? routeFeature(upcomingCoordinates) : emptyLine,
  );
  setSourceData(map, 'route-active', emptyLine);
  setSourceData(map, 'points-past', pointsFeatureCollection(photos.slice(0, fromIndex + 1)));
  setSourceData(map, 'point-current', fromCoordinate ? pointFeature(fromCoordinate) : emptyPoints);
  setSourceData(map, 'point-upcoming', toCoordinate ? pointFeature(toCoordinate) : emptyPoints);
  setSourceData(map, 'point-moving', emptyPoints);
  setFootprintLayerMode(map, 'moving', mapTheme);
}
