import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { stabilizeProjectedAnchor, type ScreenAnchor } from './footprintMapAnchor';
import { addFootprintLayers, addFootprintSources, setSourceData } from './footprintMapLayers';
import { setHoldingVisualState, setMovingVisualState, syncMapData } from './footprintMapVisualState';
import { buildMapStyle } from './mapStyles';
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
  routeCoordinatesWithProgress,
  routeFeature,
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
  onDone: () => void;
};

const defaultCenter: [number, number] = [116.3974, 39.9093];

export default function FootprintMap({
  photos,
  currentIndex,
  isPlaying,
  speed,
  mapTheme,
  onAnchorChange,
  onIndexChange,
  onDone,
}: FootprintMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const nextPopoverTimeoutRef = useRef<number | null>(null);
  const activePopoverIndexRef = useRef<number | null>(currentIndex);
  const lastPublishedAnchorRef = useRef<ScreenAnchor | null>(null);
  const lastPublishedAnchorIndexRef = useRef<number | null>(currentIndex);
  const indexRef = useRef(currentIndex);
  const playingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const mapThemeRef = useRef(mapTheme);
  const onAnchorChangeRef = useRef(onAnchorChange);
  const onDoneRef = useRef(onDone);
  const onIndexChangeRef = useRef(onIndexChange);

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
      syncMapData(map, photos, currentIndex, true);
      activePopoverIndexRef.current = currentIndex;
      publishAnchorForIndex(currentIndex);
      map.once('moveend', () => publishAnchorForIndex(currentIndex));
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
      syncMapData(map, photos, currentIndex, true);
      activePopoverIndexRef.current = currentIndex;
      publishAnchorForIndex(currentIndex);
      map.once('moveend', () => publishAnchorForIndex(currentIndex));
    });
  }, [mapTheme, photos, currentIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const run = () => syncMapData(map, photos, currentIndex, true);
    if (map.isStyleLoaded()) {
      run();
      activePopoverIndexRef.current = currentIndex;
      publishAnchorForIndex(currentIndex);
      map.once('moveend', () => publishAnchorForIndex(currentIndex));
    } else {
      map.once('load', () => {
        run();
        activePopoverIndexRef.current = currentIndex;
        publishAnchorForIndex(currentIndex);
        map.once('moveend', () => publishAnchorForIndex(currentIndex));
      });
    }
  }, [photos, coordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isPlaying) return;

    const run = () => syncMapData(map, photos, currentIndex, false);
    if (map.isStyleLoaded()) {
      run();
      activePopoverIndexRef.current = currentIndex;
      publishAnchorForIndex(currentIndex);
    } else {
      map.once('load', () => {
        run();
        activePopoverIndexRef.current = currentIndex;
        publishAnchorForIndex(currentIndex);
      });
    }
  }, [currentIndex, photos, isPlaying]);

  useEffect(() => {
    if (!isPlaying || photos.length < 2) return;

    let cancelled = false;

    const playNext = () => {
      if (cancelled || !playingRef.current) return;
      const fromIndex = indexRef.current;

      if (fromIndex >= photos.length - 1) {
        onDoneRef.current();
        return;
      }

      const nextIndex = fromIndex + 1;
      let didShowNextPopover = false;

      const showNextPopover = () => {
        if (didShowNextPopover || cancelled || !playingRef.current) return;

        didShowNextPopover = true;
        indexRef.current = nextIndex;
        activePopoverIndexRef.current = nextIndex;
        onIndexChangeRef.current(nextIndex);
        publishAnchorForIndex(nextIndex);
      };

      activePopoverIndexRef.current = null;
      lastPublishedAnchorRef.current = null;
      onAnchorChangeRef.current(null);
      showMovingVisualState(fromIndex);
      nextPopoverTimeoutRef.current = window.setTimeout(() => {
        nextPopoverTimeoutRef.current = null;
        showNextPopover();
      }, 100);

      animateSegment(fromIndex, () => {
        if (cancelled) return;

        showNextPopover();

        holdAtStep(() => {
          if (cancelled) return;

          if (nextIndex >= photos.length - 1) {
            onDoneRef.current();
            return;
          }

          playNext();
        });
      });
    };

    playNext();

    return () => {
      cancelled = true;
      stopAnimationTimers();
    };
  }, [isPlaying, photos]);

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
  }

  function animateSegment(fromIndex: number, onComplete: () => void) {
    const map = mapRef.current;
    const from = photos[fromIndex];
    const to = photos[fromIndex + 1];
    if (!map || !from || !to) return;

    const distance = distanceKm(from, to);
    const duration = durationForDistance(distance, speedRef.current);
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
      const cameraProgress = appleEaseInOut(segmentProgress(rawProgress, 0, cameraLeadEnd));
      const movementProgress = appleEaseInOut(segmentProgress(rawProgress, movementStart, 1));
      const currentCoord = interpolateGreatCircle(from, to, movementProgress);
      const progressCoordinates = routeCoordinatesWithProgress(photos, fromIndex, movementProgress);

      setSourceData(map, 'route-active', routeFeature(progressCoordinates));
      setSourceData(map, 'point-moving', pointFeature(currentCoord));

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
        showHoldingVisualState(fromIndex + 1);
        onComplete();
      }
    };

    frameRef.current = requestAnimationFrame(step);
  }

  function showHoldingVisualState(index: number) {
    const map = mapRef.current;
    if (!map) return;

    setHoldingVisualState(map, photos, coordinates, index);
  }

  function showMovingVisualState(fromIndex: number) {
    const map = mapRef.current;
    if (!map) return;

    setMovingVisualState(map, photos, coordinates, fromIndex);
  }

  function publishAnchorForIndex(index: number) {
    if (lastPublishedAnchorIndexRef.current !== index) {
      lastPublishedAnchorRef.current = null;
      lastPublishedAnchorIndexRef.current = index;
    }

    const coordinate = coordinates[index];
    publishAnchor(coordinate);
  }

  function publishActivePopoverAnchor() {
    const activeIndex = activePopoverIndexRef.current;
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

  return <div ref={containerRef} className="map-canvas" aria-label="照片足迹地图" />;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
