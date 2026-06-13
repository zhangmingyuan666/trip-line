import * as turf from '@turf/turf';
import type { PhotoPoint, PlaybackSpeed } from '../photo/types';

export type LngLat = [number, number];

export function toLngLat(photo: PhotoPoint): LngLat {
  return [photo.lng, photo.lat];
}

export function distanceKm(from: PhotoPoint, to: PhotoPoint): number {
  return turf.distance(turf.point(toLngLat(from)), turf.point(toLngLat(to)), {
    units: 'kilometers',
  });
}

export function routeSegmentCoordinates(from: PhotoPoint, to: PhotoPoint): LngLat[] {
  const distance = distanceKm(from, to);
  const pointCount = Math.max(2, Math.min(96, Math.ceil(distance / 80) + 1));

  return Array.from({ length: pointCount }, (_, index) =>
    interpolateGreatCircle(from, to, index / (pointCount - 1)),
  );
}

export function routeCoordinatesForPhotos(photos: PhotoPoint[], throughIndex: number): LngLat[] {
  if (throughIndex < 0 || photos.length === 0) return [];

  const lastIndex = Math.min(throughIndex, photos.length - 1);
  const coordinates: LngLat[] = [toLngLat(photos[0])];

  for (let index = 0; index < lastIndex; index += 1) {
    coordinates.push(...routeSegmentCoordinates(photos[index], photos[index + 1]).slice(1));
  }

  return coordinates;
}

export function routeSegmentCoordinatesWithProgress(
  from: PhotoPoint,
  to: PhotoPoint,
  progress: number,
  segmentCoordinates = routeSegmentCoordinates(from, to),
): LngLat[] {
  const safeProgress = clamp01(progress);
  if (safeProgress <= 0) return [];
  if (safeProgress >= 1) return segmentCoordinates;

  const currentCoordinate = interpolateGreatCircle(from, to, safeProgress);
  const visibleSegmentCoordinates = segmentCoordinates.filter(
    (_, index) => index > 0 && index / (segmentCoordinates.length - 1) < safeProgress,
  );

  return [segmentCoordinates[0], ...visibleSegmentCoordinates, currentCoordinate];
}

export function durationForDistance(distance: number, speed: PlaybackSpeed): number {
  const multiplier = speed === 'slow' ? 1.45 : speed === 'fast' ? 0.65 : 1;
  const base = 1200 + Math.sqrt(Math.min(distance, 1800)) * 140;
  return Math.max(1200, Math.min(6200, base * multiplier));
}

export function holdDurationForSpeed(speed: PlaybackSpeed): number {
  if (speed === 'slow') return 1100;
  if (speed === 'fast') return 400;
  return 700;
}

export function zoomForDistance(distance: number): number {
  const stops: Array<[number, number]> = [
    [0.005, 16.5],
    [0.02, 16.1],
    [0.08, 15.3],
    [0.1, 15],
    [2, 14],
    [8, 12.7],
    [30, 10.9],
    [120, 8.8],
    [420, 6.5],
    [1200, 4.6],
    [3000, 3.4],
  ];

  const safeDistance = Math.max(distance, stops[0][0]);
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [startDistance, startZoom] = stops[index];
    const [endDistance, endZoom] = stops[index + 1];
    if (safeDistance <= endDistance) {
      const progress =
        (Math.log(safeDistance) - Math.log(startDistance)) /
        (Math.log(endDistance) - Math.log(startDistance));
      return interpolateNumber(startZoom, endZoom, appleEaseInOut(clamp01(progress)));
    }
  }

  return stops[stops.length - 1][1];
}

export function interpolateGreatCircle(from: PhotoPoint, to: PhotoPoint, progress: number): LngLat {
  const distance = distanceKm(from, to);
  if (distance === 0) return toLngLat(from);

  const point = turf.destination(turf.point(toLngLat(from)), distance * clamp01(progress), bearing(from, to), {
    units: 'kilometers',
  });

  return point.geometry.coordinates as LngLat;
}

export function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function appleEaseInOut(value: number): number {
  return cubicBezier(0.42, 0, 0.58, 1, clamp01(value));
}

export function appleEaseOut(value: number): number {
  return cubicBezier(0.2, 0.8, 0.2, 1, clamp01(value));
}

export function segmentProgress(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function interpolateNumber(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function interpolateBearing(from: number, to: number, progress: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta * progress;
}

export function dampedBearing(from: number, to: number, strength = 0.28, maxDelta = 38): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  const limitedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta * strength));
  return from + limitedDelta;
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const epsilon = 0.00001;
  let lowerBound = 0;
  let upperBound = 1;
  let t = x;

  for (let i = 0; i < 12; i += 1) {
    const estimate = bezierCoordinate(t, x1, x2);
    if (Math.abs(estimate - x) < epsilon) break;
    if (estimate > x) {
      upperBound = t;
    } else {
      lowerBound = t;
    }
    t = (upperBound + lowerBound) / 2;
  }

  return bezierCoordinate(t, y1, y2);
}

function bezierCoordinate(t: number, point1: number, point2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * point1 + 3 * inverse * t * t * point2 + t * t * t;
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
