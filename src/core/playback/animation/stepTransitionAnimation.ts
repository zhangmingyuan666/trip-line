import { Map as MapLibreMap } from 'maplibre-gl';
import { emptyLine, setSourceData } from '../../../components/footprint-map/layers';
import {
  appleEaseInOut,
  bearing,
  dampedBearing,
  distanceKm,
  durationForDistance,
  interpolateBearing,
  interpolateGreatCircle,
  interpolateNumber,
  pointFeature,
  routeFeature,
  routeSegmentCoordinates,
  routeSegmentCoordinatesWithProgress,
  segmentProgress,
  zoomForDistance,
} from '../../map/geometry';
import type { StepTransition } from '../state/types';
import type { PhotoPoint, PlaybackSpeed } from '../../photo/types';

export type StepTransitionTargetCamera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

type StepTransitionAnimationOptions = {
  map: MapLibreMap;
  photos: PhotoPoint[];
  speed: PlaybackSpeed;
  transition: StepTransition;
  canContinue: () => boolean;
  onComplete: () => void;
  onFrame: (rawProgress: number) => void;
  onPublishAnchor: () => void;
};

export function startStepTransitionAnimation({
  map,
  photos,
  speed,
  transition,
  canContinue,
  onComplete,
  onFrame,
  onPublishAnchor,
}: StepTransitionAnimationOptions): () => void {
  const from = photos[transition.fromIndex];
  const to = photos[transition.toIndex];
  if (!from || !to) return () => undefined;

  const distance = distanceKm(from, to);
  const duration = durationForDistance(distance, speed);
  const segmentCoordinates = routeSegmentCoordinates(from, to);
  const targetCamera = getStepTransitionTargetCamera(map, photos, transition);
  if (!targetCamera) return () => undefined;

  const cameraLeadEnd = distance > 80 ? 0.82 : 0.76;
  const movementStart = distance > 80 ? 0.08 : 0.04;
  const startCamera = {
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
  const startTime = performance.now();
  let frameId: number | null = null;
  let cancelled = false;

  const step = (time: number) => {
    if (cancelled || !canContinue()) return;

    const rawProgress = Math.min(1, (time - startTime) / duration);
    onFrame(rawProgress);

    const cameraProgress = appleEaseInOut(segmentProgress(rawProgress, 0, cameraLeadEnd));
    const movementProgress = appleEaseInOut(segmentProgress(rawProgress, movementStart, 1));
    const currentCoord = interpolateGreatCircle(from, to, movementProgress);
    const progressCoordinates = routeSegmentCoordinatesWithProgress(from, to, movementProgress, segmentCoordinates);

    setSourceData(map, 'route-active', progressCoordinates.length > 1 ? routeFeature(progressCoordinates) : emptyLine);
    setSourceData(map, 'point-current', pointFeature(currentCoord));

    map.jumpTo({
      center: currentCoord,
      zoom: interpolateNumber(startCamera.zoom, targetCamera.zoom, cameraProgress),
      bearing: interpolateBearing(startCamera.bearing, targetCamera.bearing, cameraProgress),
      pitch: interpolateNumber(startCamera.pitch, targetCamera.pitch, cameraProgress),
    });
    onPublishAnchor();

    if (rawProgress < 1) {
      frameId = requestAnimationFrame(step);
      return;
    }

    frameId = null;
    onComplete();
  };

  frameId = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };
}

export function getStepTransitionTargetCamera(
  map: MapLibreMap,
  photos: PhotoPoint[],
  transition: StepTransition,
): StepTransitionTargetCamera | null {
  const from = photos[transition.fromIndex];
  const to = photos[transition.toIndex];
  if (!from || !to) return null;

  const distance = distanceKm(from, to);
  const reducedMotion = prefersReducedMotion();
  const startBearing = map.getBearing();
  const rawBearing = bearing(from, to);
  const targetBearing =
    reducedMotion || !Number.isFinite(rawBearing) ? startBearing : dampedBearing(startBearing, rawBearing, 0.18, 24);

  return {
    center: [to.lng, to.lat],
    zoom: zoomForDistance(distance),
    bearing: targetBearing,
    pitch: reducedMotion ? 0 : distance > 80 ? 28 : 34,
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
