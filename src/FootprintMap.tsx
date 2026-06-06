import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { buildMapStyle, isDarkMapTheme } from './mapStyles';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from './types';
import {
  appleEaseInOut,
  bearing,
  dampedBearing,
  distanceKm,
  durationForDistance,
  holdDurationForSpeed,
  interpolate,
  interpolateBearing,
  interpolateNumber,
  pointFeature,
  pointsFeatureCollection,
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

const emptyLine = routeFeature([]);
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
  const lastPublishedAnchorRef = useRef<{ x: number; y: number } | null>(null);
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

    const fromCoord = toLngLat(from);
    const toCoord = toLngLat(to);
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
      const currentCoord = interpolate(fromCoord, toCoord, movementProgress);
      const progressCoordinates = [...coordinates.slice(0, fromIndex + 1), currentCoord];

      setSourceData(map, 'route-progress', routeFeature(progressCoordinates));
      setSourceData(map, 'current-point', pointFeature(currentCoord));

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
        onComplete();
      }
    };

    frameRef.current = requestAnimationFrame(step);
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

function stabilizeProjectedAnchor(
  point: { x: number; y: number },
  map: MapLibreMap,
  previousAnchor: { x: number; y: number } | null,
): { x: number; y: number } {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return point;

  const padding = Math.min(32, Math.max(18, Math.min(width, height) * 0.04));
  const targetAnchor = isPointInsideViewport(point, width, height, padding)
    ? point
    : projectPointToViewportEdge(point, width, height, padding);

  if (!previousAnchor) return targetAnchor;

  const distance = Math.hypot(targetAnchor.x - previousAnchor.x, targetAnchor.y - previousAnchor.y);
  if (distance < 1.4) return previousAnchor;

  const isTargetVisible = isPointInsideViewport(point, width, height, padding * 1.35);
  if (isTargetVisible) return targetAnchor;

  return {
    x: interpolateNumber(previousAnchor.x, targetAnchor.x, 0.18),
    y: interpolateNumber(previousAnchor.y, targetAnchor.y, 0.18),
  };
}

function isPointInsideViewport(point: { x: number; y: number }, width: number, height: number, padding: number): boolean {
  return point.x >= padding && point.x <= width - padding && point.y >= padding && point.y <= height - padding;
}

function projectPointToViewportEdge(
  point: { x: number; y: number },
  width: number,
  height: number,
  padding: number,
): { x: number; y: number } {
  const minX = padding;
  const maxX = Math.max(minX, width - padding);
  const minY = padding;
  const maxY = Math.max(minY, height - padding);
  const centerX = width / 2;
  const centerY = height / 2;
  const deltaX = point.x - centerX;
  const deltaY = point.y - centerY;
  let scale = Number.POSITIVE_INFINITY;

  if (deltaX > 0) scale = Math.min(scale, (maxX - centerX) / deltaX);
  if (deltaX < 0) scale = Math.min(scale, (minX - centerX) / deltaX);
  if (deltaY > 0) scale = Math.min(scale, (maxY - centerY) / deltaY);
  if (deltaY < 0) scale = Math.min(scale, (minY - centerY) / deltaY);

  if (!Number.isFinite(scale) || scale < 0) {
    return {
      x: Math.min(maxX, Math.max(minX, point.x)),
      y: Math.min(maxY, Math.max(minY, point.y)),
    };
  }

  return {
    x: Math.min(maxX, Math.max(minX, centerX + deltaX * scale)),
    y: Math.min(maxY, Math.max(minY, centerY + deltaY * scale)),
  };
}

function syncMapData(map: MapLibreMap, photos: PhotoPoint[], currentIndex: number, shouldFitBounds: boolean) {
  if (!map.getSource('route-shadow')) return;

  const coordinates = photos.map(toLngLat);
  setSourceData(map, 'route-shadow', coordinates.length > 1 ? routeFeature(coordinates) : emptyLine);
  setSourceData(
    map,
    'route-progress',
    coordinates.length > 0 ? routeFeature(coordinates.slice(0, currentIndex + 1)) : emptyLine,
  );
  setSourceData(map, 'photo-points', pointsFeatureCollection(photos));

  if (coordinates[currentIndex]) {
    setSourceData(map, 'current-point', pointFeature(coordinates[currentIndex]));
  }

  if (!shouldFitBounds) {
    return;
  }

  if (coordinates.length === 1) {
    map.easeTo({ center: coordinates[0], zoom: 13, duration: 700 });
    return;
  }

  if (coordinates.length > 1) {
    const bounds = coordinates.reduce(
      (lngLatBounds, coordinate) => lngLatBounds.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    );

    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 160, left: 360 },
      duration: 900,
      maxZoom: 12,
    });
  }
}

function setSourceData(map: MapLibreMap, sourceId: string, data: GeoJSON.Feature | GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data);
}

function addFootprintSources(map: MapLibreMap) {
  if (!map.getSource('route-shadow')) {
    map.addSource('route-shadow', {
      type: 'geojson',
      data: emptyLine,
    });
  }

  if (!map.getSource('route-progress')) {
    map.addSource('route-progress', {
      type: 'geojson',
      data: emptyLine,
    });
  }

  if (!map.getSource('photo-points')) {
    map.addSource('photo-points', {
      type: 'geojson',
      data: pointsFeatureCollection([]),
    });
  }

  if (!map.getSource('current-point')) {
    map.addSource('current-point', {
      type: 'geojson',
      data: pointFeature(defaultCenter),
    });
  }
}

function addFootprintLayers(map: MapLibreMap, mapTheme: MapTheme) {
  const isDark = isDarkMapTheme(mapTheme);

  if (!map.getLayer('route-shadow')) {
    map.addLayer({
      id: 'route-shadow',
      type: 'line',
      source: 'route-shadow',
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

  if (!map.getLayer('route-progress')) {
    map.addLayer({
      id: 'route-progress',
      type: 'line',
      source: 'route-progress',
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

  if (!map.getLayer('photo-points')) {
    map.addLayer({
      id: 'photo-points',
      type: 'circle',
      source: 'photo-points',
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 4.5,
        'circle-stroke-color': isDark ? '#f07b3f' : '#143f5f',
        'circle-stroke-width': 2,
      },
    });
  }

  if (!map.getLayer('current-point')) {
    map.addLayer({
      id: 'current-point',
      type: 'circle',
      source: 'current-point',
      paint: {
        'circle-color': '#f07b3f',
        'circle-radius': 8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
  }
}
