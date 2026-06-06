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
  onIndexChange,
  onDone,
}: FootprintMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const indexRef = useRef(currentIndex);
  const playingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const mapThemeRef = useRef(mapTheme);
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
    });
  }, [mapTheme, photos, currentIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const run = () => syncMapData(map, photos, currentIndex, true);
    if (map.isStyleLoaded()) {
      run();
    } else {
      map.once('load', run);
    }
  }, [photos, coordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isPlaying) return;

    const run = () => syncMapData(map, photos, currentIndex, false);
    if (map.isStyleLoaded()) {
      run();
    } else {
      map.once('load', run);
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
      indexRef.current = nextIndex;
      onIndexChangeRef.current(nextIndex);

      animateSegment(fromIndex, () => {
        if (cancelled) return;

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

      if (rawProgress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        onComplete();
      }
    };

    frameRef.current = requestAnimationFrame(step);
  }

  return <div ref={containerRef} className="map-canvas" aria-label="照片足迹地图" />;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
