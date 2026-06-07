import { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { isDarkMapTheme } from './mapStyles';
import { pointsFeatureCollection, routeFeature } from './mapUtils';
import type { MapTheme } from './types';

export const emptyLine = routeFeature([]);
export const emptyPoints = pointsFeatureCollection([]);

type FootprintLayerMode = 'holding' | 'moving';

const noTransition = { duration: 0, delay: 0 };

export function setSourceData(map: MapLibreMap, sourceId: string, data: GeoJSON.Feature | GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data);
}

export function setFootprintLayerMode(map: MapLibreMap, mode: FootprintLayerMode, mapTheme: MapTheme) {
  const isDark = isDarkMapTheme(mapTheme);
  const upcomingOpacity = isDark ? 0.48 : 0.42;

  setPaintPropertyIfLayerExists(map, 'route-upcoming', 'line-opacity', mode === 'moving' ? upcomingOpacity * 0.72 : upcomingOpacity);
  setPaintPropertyIfLayerExists(map, 'point-current', 'circle-opacity', 1);
  setPaintPropertyIfLayerExists(map, 'point-current', 'circle-stroke-opacity', 1);
  setPaintPropertyIfLayerExists(map, 'point-moving', 'circle-opacity', 0);
  setPaintPropertyIfLayerExists(map, 'point-moving', 'circle-stroke-opacity', 0);
}

function disableFootprintLayerTransitions(map: MapLibreMap) {
  setPaintPropertyIfLayerExists(map, 'route-past', 'line-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'route-upcoming', 'line-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'route-active', 'line-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'points-past', 'circle-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'points-past', 'circle-stroke-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'point-upcoming', 'circle-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'point-upcoming', 'circle-stroke-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'point-current', 'circle-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'point-current', 'circle-stroke-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'point-moving', 'circle-opacity-transition', noTransition);
  setPaintPropertyIfLayerExists(map, 'point-moving', 'circle-stroke-opacity-transition', noTransition);
}

function setPaintPropertyIfLayerExists(
  map: MapLibreMap,
  layerId: string,
  property: string,
  value: string | number | unknown[] | Record<string, unknown>,
) {
  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, property, value);
  }
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
  const pastRouteColor = isDark ? '#9aa7b1' : '#365968';
  const futureRouteColor = isDark ? '#d5dbe0' : '#496a7a';
  const activeColor = '#f16f3a';
  const pointHaloColor = isDark ? '#101820' : '#ffffff';

  if (!map.getLayer('route-past')) {
    map.addLayer({
      id: 'route-past',
      type: 'line',
      source: 'route-past',
      paint: {
        'line-color': pastRouteColor,
        'line-opacity': isDark ? 0.42 : 0.36,
        'line-width': 4.5,
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
        'line-color': futureRouteColor,
        'line-dasharray': [0.18, 2.15],
        'line-opacity': isDark ? 0.48 : 0.42,
        'line-width': 4.25,
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
        'line-color': activeColor,
        'line-width': 6,
        'line-opacity': 0.92,
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
        'circle-color': isDark ? '#1d2932' : '#ffffff',
        'circle-opacity': isDark ? 0.72 : 0.82,
        'circle-radius': 4,
        'circle-stroke-color': pastRouteColor,
        'circle-stroke-opacity': isDark ? 0.78 : 0.7,
        'circle-stroke-width': 1.8,
      },
    });
  }

  if (!map.getLayer('point-upcoming')) {
    map.addLayer({
      id: 'point-upcoming',
      type: 'circle',
      source: 'point-upcoming',
      paint: {
        'circle-color': isDark ? '#151f27' : '#ffffff',
        'circle-opacity': 0.9,
        'circle-radius': 5.25,
        'circle-stroke-color': futureRouteColor,
        'circle-stroke-opacity': 0.82,
        'circle-stroke-width': 2.25,
      },
    });
  }

  if (!map.getLayer('point-current')) {
    map.addLayer({
      id: 'point-current',
      type: 'circle',
      source: 'point-current',
      paint: {
        'circle-color': activeColor,
        'circle-opacity': 1,
        'circle-radius': 8.5,
        'circle-stroke-color': pointHaloColor,
        'circle-stroke-opacity': 1,
        'circle-stroke-width': 3.5,
      },
    });
  }

  if (!map.getLayer('point-moving')) {
    map.addLayer({
      id: 'point-moving',
      type: 'circle',
      source: 'point-moving',
      paint: {
        'circle-color': activeColor,
        'circle-opacity': 0,
        'circle-radius': 7.5,
        'circle-stroke-color': pointHaloColor,
        'circle-stroke-opacity': 0,
        'circle-stroke-width': 3.25,
      },
    });
  }

  disableFootprintLayerTransitions(map);
}
