import type { StyleSpecification } from 'maplibre-gl';
import type { MapTheme } from './types';

export const mapThemeLabels: Record<MapTheme, string> = {
  clean: '清爽',
  travel: '旅行',
  dark: '深色',
  standard: '标准',
};

const tileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function buildMapStyle(theme: MapTheme): StyleSpecification {
  const config = getThemeConfig(theme);

  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: [config.tiles],
        tileSize: 256,
        attribution: config.attribution,
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: {
          'raster-opacity': config.opacity,
          'raster-resampling': 'linear',
        },
      },
    ],
  };
}

export function isDarkMapTheme(theme: MapTheme): boolean {
  return theme === 'dark';
}

function getThemeConfig(theme: MapTheme) {
  switch (theme) {
    case 'travel':
      return {
        tiles: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        attribution: tileAttribution,
        opacity: 0.96,
      };
    case 'dark':
      return {
        tiles: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        attribution: tileAttribution,
        opacity: 0.92,
      };
    case 'standard':
      return {
        tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        opacity: 0.92,
      };
    case 'clean':
    default:
      return {
        tiles: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        attribution: tileAttribution,
        opacity: 0.98,
      };
  }
}
