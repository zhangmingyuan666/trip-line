import { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { isDarkMapTheme } from './mapStyles';
import { pointsFeatureCollection, routeFeature } from './mapUtils';
import type { MapTheme } from './types';

export const emptyLine = routeFeature([]);
export const emptyPoints = pointsFeatureCollection([]);

export function setSourceData(map: MapLibreMap, sourceId: string, data: GeoJSON.Feature | GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data);
}

export function addFootprintSources(map: MapLibreMap) {
  if (!map.getSource('route-past')) {
    map.addSource('route-past', {
      type: 'geojson',
      data: emptyLine,
    });
  }

  if (!map.getSource('route-upcoming')) {
    map.addSource('route-upcoming', {
      type: 'geojson',
      data: emptyLine,
    });
  }

  if (!map.getSource('route-active')) {
    map.addSource('route-active', {
      type: 'geojson',
      data: emptyLine,
    });
  }

  if (!map.getSource('points-past')) {
    map.addSource('points-past', {
      type: 'geojson',
      data: emptyPoints,
    });
  }

  if (!map.getSource('point-current')) {
    map.addSource('point-current', {
      type: 'geojson',
      data: emptyPoints,
    });
  }

  if (!map.getSource('point-upcoming')) {
    map.addSource('point-upcoming', {
      type: 'geojson',
      data: emptyPoints,
    });
  }

  if (!map.getSource('point-moving')) {
    map.addSource('point-moving', {
      type: 'geojson',
      data: emptyPoints,
    });
  }
}

export function addFootprintLayers(map: MapLibreMap, mapTheme: MapTheme) {
  const isDark = isDarkMapTheme(mapTheme);

  if (!map.getLayer('route-past')) {
    map.addLayer({
      id: 'route-past',
      type: 'line',
      source: 'route-past',
      paint: {
        'line-color': isDark ? '#ffffff' : '#143f5f',
        'line-opacity': isDark ? 0.22 : 0.24,
        'line-width': 7,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
  }

  if (!map.getLayer('route-upcoming')) {
    map.addLayer({
      id: 'route-upcoming',
      type: 'line',
      source: 'route-upcoming',
      paint: {
        'line-color': isDark ? '#ffffff' : '#143f5f',
        'line-dasharray': [1.2, 1.4],
        'line-opacity': isDark ? 0.28 : 0.32,
        'line-width': 4,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
  }

  if (!map.getLayer('route-active')) {
    map.addLayer({
      id: 'route-active',
      type: 'line',
      source: 'route-active',
      paint: {
        'line-color': '#f07b3f',
        'line-width': 5,
        'line-opacity': 0.98,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
  }

  if (!map.getLayer('points-past')) {
    map.addLayer({
      id: 'points-past',
      type: 'circle',
      source: 'points-past',
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 4.5,
        'circle-stroke-color': isDark ? '#f07b3f' : '#143f5f',
        'circle-stroke-width': 2,
      },
    });
  }

  if (!map.getLayer('point-upcoming')) {
    map.addLayer({
      id: 'point-upcoming',
      type: 'circle',
      source: 'point-upcoming',
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 5.5,
        'circle-stroke-color': '#f07b3f',
        'circle-stroke-opacity': 0.72,
        'circle-stroke-width': 2.5,
      },
    });
  }

  if (!map.getLayer('point-current')) {
    map.addLayer({
      id: 'point-current',
      type: 'circle',
      source: 'point-current',
      paint: {
        'circle-color': '#f07b3f',
        'circle-radius': 8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
  }

  if (!map.getLayer('point-moving')) {
    map.addLayer({
      id: 'point-moving',
      type: 'circle',
      source: 'point-moving',
      paint: {
        'circle-color': '#f07b3f',
        'circle-radius': 7,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
  }
}
