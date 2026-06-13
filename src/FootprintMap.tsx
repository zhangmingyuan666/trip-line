import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { stabilizeProjectedAnchor, type ScreenAnchor } from './footprintMapAnchor';
import {
  addFootprintLayers,
  addFootprintSources,
  emptyLine,
  setSourceData,
} from './footprintMapLayers';
import { setHoldingVisualState, setMovingVisualState, syncMapData } from './footprintMapVisualState';
import { buildMapStyle } from './mapStyles';
import {
  buildPlaybackContext,
  createDonePlaybackState,
  createHoldingPlaybackState,
  createInitialCameraPlaybackState,
  createInitialRevealPlaybackState,
  createPausedPlaybackState,
  createTransitionPlaybackState,
  getNextStepTransition,
  withActivePopoverIndex,
  withTransitionProgress,
  type PlaybackState,
  type StepTransition,
} from './playbackState';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from './types';
import {
  appleEaseInOut,
  bearing,
  dampedBearing,
  distanceKm,
  durationForDistance,
  holdDurationForSpeed,
  interpolateGreatCircle,
  interpolateBearing,
  interpolateNumber,
  pointFeature,
  routeFeature,
  routeSegmentCoordinates,
  routeSegmentCoordinatesWithProgress,
  segmentProgress,
  toLngLat,
  zoomForDistance,
} from './mapUtils';

type FootprintMapProps = {
  photos: PhotoPoint[];
  currentIndex: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  mapTheme: MapTheme;
  onAnchorChange: (anchor: { x: number; y: number } | null) => void;
  onIndexChange: (index: number) => void;
  onPreviewIndexChange: (index: number) => void;
  onDone: () => void;
};

const defaultCenter: [number, number] = [116.3974, 39.9093];
const initialStepSettleDuration = 450;
const initialPopoverSettleDuration = 1000;
const nextStepPreviewDelay = 100;

export default function FootprintMap({
  photos,
  currentIndex,
  isPlaying,
  speed,
  mapTheme,
  onAnchorChange,
  onIndexChange,
  onPreviewIndexChange,
  onDone,
}: FootprintMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const frameRef = useRef<number | null>(null);
  const initialPlaybackTimeoutRef = useRef<number | null>(null);
  const initialCameraTimeoutRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const nextPopoverTimeoutRef = useRef<number | null>(null);
  const playbackStateRef = useRef<PlaybackState>(createHoldingPlaybackState(currentIndex));
  const hasStartedInitialCameraRef = useRef(false);
  const hasCompletedInitialCameraRef = useRef(false);
  const initialCameraWaitersRef = useRef<Array<() => void>>([]);
  const hasRevealedInitialStepRef = useRef(false);
  const lastPublishedAnchorRef = useRef<ScreenAnchor | null>(null);
  const lastPublishedAnchorIndexRef = useRef<number | null>(currentIndex);
  const indexRef = useRef(currentIndex);
  const playingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const mapThemeRef = useRef(mapTheme);
  const onAnchorChangeRef = useRef(onAnchorChange);
  const onDoneRef = useRef(onDone);
  const onIndexChangeRef = useRef(onIndexChange);
  const onPreviewIndexChangeRef = useRef(onPreviewIndexChange);

  const coordinates = useMemo(() => photos.map(toLngLat), [photos]);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    onAnchorChangeRef.current = onAnchorChange;
  }, [onAnchorChange]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    onPreviewIndexChangeRef.current = onPreviewIndexChange;
  }, [onPreviewIndexChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: defaultCenter,
      zoom: 3.8,
      pitch: 36,
      bearing: 0,
      attributionControl: false,
      style: buildMapStyle(mapTheme),
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: '照片足迹',
      }),
      'bottom-right',
    );

    map.on('load', () => {
      addFootprintSources(map);
      addFootprintLayers(map, mapTheme);
      map.once('moveend', completeInitialCamera);
      hasStartedInitialCameraRef.current = true;
      setPlaybackState(createInitialCameraPlaybackState(currentIndex));
      const initialCameraDuration = syncMapData(map, photos, currentIndex, true, mapTheme);
      if (initialCameraDuration === 0) {
        completeInitialCamera();
      } else {
        initialCameraTimeoutRef.current = window.setTimeout(completeInitialCamera, initialCameraDuration + 600);
      }
    });

    mapRef.current = map;

    return () => {
      stopAnimationTimers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapThemeRef.current === mapTheme) return;

    mapThemeRef.current = mapTheme;
    stopAnimationTimers();

    map.setStyle(buildMapStyle(mapTheme));
    map.once('idle', () => {
      addFootprintSources(map);
      addFootprintLayers(map, mapTheme);
      syncMapData(map, photos, currentIndex, true, mapTheme);
      setPlaybackState(createHoldingPlaybackState(currentIndex));
      publishAnchorForIndex(currentIndex);
      map.once('moveend', () => publishAnchorForIndex(currentIndex));
    });
  }, [mapTheme, photos, currentIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const run = () => syncMapData(map, photos, currentIndex, true, mapTheme);
    if (map.isStyleLoaded()) {
      run();
      if (!playingRef.current) {
        setPlaybackState(createHoldingPlaybackState(currentIndex));
      }
      publishAnchorForIndex(currentIndex);
      map.once('moveend', () => publishAnchorForIndex(currentIndex));
    } else {
      map.once('load', () => {
        run();
        if (!playingRef.current) {
          setPlaybackState(createHoldingPlaybackState(currentIndex));
        }
        publishAnchorForIndex(currentIndex);
        map.once('moveend', () => publishAnchorForIndex(currentIndex));
      });
    }
  }, [photos, coordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isPlaying) return;

    const run = () => syncMapData(map, photos, currentIndex, false, mapTheme);
    if (map.isStyleLoaded()) {
      run();
      setPlaybackState(createPausedPlaybackState(currentIndex));
      publishAnchorForIndex(currentIndex);
    } else {
      map.once('load', () => {
        run();
        setPlaybackState(createPausedPlaybackState(currentIndex));
        publishAnchorForIndex(currentIndex);
      });
    }
  }, [currentIndex, photos, isPlaying]);

  useEffect(() => {
    if (!isPlaying || photos.length < 2) return;

    let cancelled = false;

    const canContinuePlayback = () => !cancelled && playingRef.current;

    const playNext = () => {
      if (!canContinuePlayback()) return;
      const fromIndex = indexRef.current;

      const transition = getNextStepTransition(fromIndex, photos.length);
      if (!transition) {
        setPlaybackState(createDonePlaybackState(fromIndex));
        onDoneRef.current();
        return;
      }

      const nextIndex = transition.toIndex;
      let didShowNextPopover = false;

      const showNextPopover = () => {
        if (didShowNextPopover || !canContinuePlayback()) return;

        didShowNextPopover = true;
        previewStep(nextIndex);
      };

      setPlaybackState(createTransitionPlaybackState('leaving', transition, 0));
      lastPublishedAnchorRef.current = null;
      onAnchorChangeRef.current(null);
      showMovingVisualState(transition);
      scheduleNextStepPreview(showNextPopover);

      animateSegment(transition, () => {
        if (cancelled) return;

        showNextPopover();

        holdAtStep(() => {
          if (cancelled) return;

          if (nextIndex >= photos.length - 1) {
            setPlaybackState(createDonePlaybackState(nextIndex));
            onDoneRef.current();
            return;
          }

          playNext();
        });
      });
    };

    startPlaybackWhenReady(playNext, canContinuePlayback);

    return () => {
      cancelled = true;
      stopAnimationTimers();
    };
  }, [isPlaying, photos]);

  function publishStep(index: number) {
    if (index === 0) {
      hasRevealedInitialStepRef.current = true;
    }

    setPlaybackState(createHoldingPlaybackState(index));
    indexRef.current = index;
    onIndexChangeRef.current(index);
    publishAnchorForIndex(index);
  }

  function previewStep(index: number) {
    setPlaybackState(withActivePopoverIndex(playbackStateRef.current, index));
    onPreviewIndexChangeRef.current(index);
    publishAnchorForIndex(index);
  }

  function scheduleNextStepPreview(onPreview: () => void) {
    nextPopoverTimeoutRef.current = window.setTimeout(() => {
      nextPopoverTimeoutRef.current = null;
      onPreview();
    }, nextStepPreviewDelay);
  }

  function startPlaybackWhenReady(playNext: () => void, canContinuePlayback: () => boolean) {
    const startAfterInitialCameraSettles = (shouldRevealInitialStep: boolean) => {
      if (!canContinuePlayback()) return;

      setPlaybackState(createInitialRevealPlaybackState(indexRef.current));
      initialPlaybackTimeoutRef.current = window.setTimeout(() => {
        if (shouldRevealInitialStep) {
          publishStep(0);
        }

        initialPlaybackTimeoutRef.current = window.setTimeout(() => {
          initialPlaybackTimeoutRef.current = null;
          playNext();
        }, shouldRevealInitialStep ? initialPopoverSettleDuration : 0);
      }, initialStepSettleDuration);
    };

    const map = mapRef.current;
    if (map && !hasCompletedInitialCameraRef.current) {
      if (!hasStartedInitialCameraRef.current) {
        map.once('load', () => startPlaybackWhenReady(playNext, canContinuePlayback));
      } else {
        onInitialCameraComplete(() => startAfterInitialCameraSettles(true));
      }
      return;
    }

    if (indexRef.current === 0) {
      startAfterInitialCameraSettles(!lastPublishedAnchorRef.current);
      return;
    }

    playNext();
  }

  function completeInitialCamera() {
    if (hasCompletedInitialCameraRef.current) return;

    hasCompletedInitialCameraRef.current = true;
    if (initialCameraTimeoutRef.current) {
      window.clearTimeout(initialCameraTimeoutRef.current);
      initialCameraTimeoutRef.current = null;
    }

    const waiters = initialCameraWaitersRef.current;
    initialCameraWaitersRef.current = [];
    waiters.forEach((waiter) => waiter());
  }

  function onInitialCameraComplete(callback: () => void) {
    if (hasCompletedInitialCameraRef.current) {
      callback();
      return;
    }

    initialCameraWaitersRef.current.push(callback);
  }

  function holdAtStep(onComplete: () => void) {
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      if (playingRef.current) {
        onComplete();
      }
    }, holdDurationForSpeed(speedRef.current));
  }

  function stopAnimationTimers() {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (nextPopoverTimeoutRef.current) {
      window.clearTimeout(nextPopoverTimeoutRef.current);
      nextPopoverTimeoutRef.current = null;
    }

    if (initialPlaybackTimeoutRef.current) {
      window.clearTimeout(initialPlaybackTimeoutRef.current);
      initialPlaybackTimeoutRef.current = null;
    }

    if (initialCameraTimeoutRef.current) {
      window.clearTimeout(initialCameraTimeoutRef.current);
      initialCameraTimeoutRef.current = null;
    }
  }

  function animateSegment(transition: StepTransition, onComplete: () => void) {
    const map = mapRef.current;
    const from = photos[transition.fromIndex];
    const to = photos[transition.toIndex];
    if (!map || !from || !to) return;

    const distance = distanceKm(from, to);
    const duration = durationForDistance(distance, speedRef.current);
    const segmentCoordinates = routeSegmentCoordinates(from, to);
    const targetZoom = zoomForDistance(distance);
    const reducedMotion = prefersReducedMotion();
    const startBearing = map.getBearing();
    const rawBearing = bearing(from, to);
    const targetBearing =
      reducedMotion || !Number.isFinite(rawBearing) ? startBearing : dampedBearing(startBearing, rawBearing, 0.18, 24);
    const targetPitch = reducedMotion ? 0 : distance > 80 ? 28 : 34;
    const cameraLeadEnd = distance > 80 ? 0.82 : 0.76;
    const movementStart = distance > 80 ? 0.08 : 0.04;
    const startCamera = {
      zoom: map.getZoom(),
      bearing: startBearing,
      pitch: map.getPitch(),
    };
    const startTime = performance.now();

    const step = (time: number) => {
      if (!playingRef.current) return;

      const rawProgress = Math.min(1, (time - startTime) / duration);
      setPlaybackState(withTransitionProgress(playbackStateRef.current, 'moving', rawProgress));
      const cameraProgress = appleEaseInOut(segmentProgress(rawProgress, 0, cameraLeadEnd));
      const movementProgress = appleEaseInOut(segmentProgress(rawProgress, movementStart, 1));
      const currentCoord = interpolateGreatCircle(from, to, movementProgress);
      const progressCoordinates = routeSegmentCoordinatesWithProgress(from, to, movementProgress, segmentCoordinates);

      setSourceData(map, 'route-active', progressCoordinates.length > 1 ? routeFeature(progressCoordinates) : emptyLine);
      setSourceData(map, 'point-current', pointFeature(currentCoord));

      map.jumpTo({
        center: currentCoord,
        zoom: interpolateNumber(startCamera.zoom, targetZoom, cameraProgress),
        bearing: interpolateBearing(startCamera.bearing, targetBearing, cameraProgress),
        pitch: interpolateNumber(startCamera.pitch, targetPitch, cameraProgress),
      });
      publishActivePopoverAnchor();

      if (rawProgress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setPlaybackState(withTransitionProgress(playbackStateRef.current, 'arriving', 1));
        showHoldingVisualState(transition.toIndex);
        publishStep(transition.toIndex);
        onComplete();
      }
    };

    frameRef.current = requestAnimationFrame(step);
  }

  function showHoldingVisualState(index: number) {
    const map = mapRef.current;
    if (!map) return;

    setHoldingVisualState(map, photos, coordinates, index, mapThemeRef.current);
  }

  function showMovingVisualState(transition: StepTransition) {
    const map = mapRef.current;
    if (!map) return;

    setMovingVisualState(map, photos, coordinates, transition.fromIndex, mapThemeRef.current);
  }

  function publishAnchorForIndex(index: number) {
    if (shouldDeferInitialAnchor(index)) return;

    if (lastPublishedAnchorIndexRef.current !== index) {
      lastPublishedAnchorRef.current = null;
      lastPublishedAnchorIndexRef.current = index;
    }

    const coordinate = coordinates[index];
    publishAnchor(coordinate);
  }

  function shouldDeferInitialAnchor(index: number) {
    return index === 0 && playingRef.current && !hasRevealedInitialStepRef.current;
  }

  function publishActivePopoverAnchor() {
    const activeIndex = getPlaybackContext().activePopoverIndex;
    if (activeIndex === null) return;

    publishAnchorForIndex(activeIndex);
  }

  function publishAnchor(coordinate: [number, number] | undefined) {
    const map = mapRef.current;
    if (!map || !coordinate) {
      lastPublishedAnchorRef.current = null;
      onAnchorChangeRef.current(null);
      return;
    }

    const point = map.project(coordinate);
    const stableAnchor = stabilizeProjectedAnchor({ x: point.x, y: point.y }, map, lastPublishedAnchorRef.current);
    lastPublishedAnchorRef.current = stableAnchor;
    onAnchorChangeRef.current(stableAnchor);
  }

  function setPlaybackState(state: PlaybackState) {
    playbackStateRef.current = state;
  }

  function getPlaybackContext() {
    return buildPlaybackContext(playbackStateRef.current, photos.length);
  }

  return <div ref={containerRef} className="map-canvas" aria-label="照片足迹地图" />;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
