import * as turf from '@turf/turf';
import type { PhotoPoint, PlaybackSpeed } from './types';

export type LngLat = [number, number];

export function toLngLat(photo: PhotoPoint): LngLat {
  return [photo.lng, photo.lat];
}

export function distanceKm(from: PhotoPoint, to: PhotoPoint): number {
  return turf.distance(turf.point(toLngLat(from)), turf.point(toLngLat(to)), {
    units: 'kilometers',
  });
}

export function durationForDistance(distance: number, speed: PlaybackSpeed): number {
  const multiplier = speed === 'slow' ? 1.45 : speed === 'fast' ? 0.65 : 1;
  const base = 1400 + Math.min(distance, 900) * 8;
  return Math.max(1400, Math.min(6500, base * multiplier));
}

export function holdDurationForSpeed(speed: PlaybackSpeed): number {
  if (speed === 'slow') return 1800;
  if (speed === 'fast') return 700;
  return 1200;
}

export function zoomForDistance(distance: number): number {
  if (distance < 1) return 15;
  if (distance < 5) return 13.5;
  if (distance < 20) return 11.5;
  if (distance < 80) return 9.5;
  if (distance < 300) return 7;
  if (distance < 1000) return 5;
  return 3.4;
}

export function interpolate(from: LngLat, to: LngLat, progress: number): LngLat {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];
}

export function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function interpolateNumber(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function interpolateBearing(from: number, to: number, progress: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta * progress;
}

export function bearing(from: PhotoPoint, to: PhotoPoint): number {
  return turf.bearing(turf.point(toLngLat(from)), turf.point(toLngLat(to)));
}

export function routeFeature(coordinates: LngLat[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
  };
}

export function pointFeature(coordinate: LngLat) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Point' as const,
      coordinates: coordinate,
    },
  };
}

export function pointsFeatureCollection(photos: PhotoPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: photos.map((photo, index) => ({
      type: 'Feature' as const,
      properties: {
        index: index + 1,
        fileName: photo.fileName,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: toLngLat(photo),
      },
    })),
  };
}
