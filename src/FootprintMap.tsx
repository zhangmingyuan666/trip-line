import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { stabilizeProjectedAnchor, type ScreenAnchor } from './footprintMapAnchor';
import { addFootprintLayers, addFootprintSources } from './footprintMapLayers';
import { setHoldingVisualState, setMovingVisualState, syncMapData } from './footprintMapVisualState';
import { startStepTransitionAnimation } from './footprintStepAnimation';
import { buildMapStyle } from './mapStyles';
import {
  createDonePlaybackState,
  createHoldingPlaybackState,
  createInitialCameraPlaybackState,
  createInitialRevealPlaybackState,
  createPausedPlaybackState,
  createTransitionPlaybackState,
  getNextStepTransition,
  withActivePopoverIndex,
  withTransitionProgress,
  type StepTransition,
} from './playbackState';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from './types';
import { toLngLat } from './mapUtils';
import { useFootprintPlaybackRuntime } from './useFootprintPlaybackRuntime';
import { useInitialCameraGate } from './useInitialCameraGate';
import { useLatestRef } from './useLatestRef';

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
  const hasRevealedInitialStepRef = useRef(false);
  const lastPublishedAnchorRef = useRef<ScreenAnchor | null>(null);
  const lastPublishedAnchorIndexRef = useRef<number | null>(currentIndex);
  const initialCameraGate = useInitialCameraGate();
  const playbackRuntime = useFootprintPlaybackRuntime(currentIndex, photos.length);
  const indexRef = useLatestRef(currentIndex);
  const playingRef = useLatestRef(isPlaying);
  const speedRef = useLatestRef(speed);
  const mapThemeRef = useLatestRef(mapTheme);
  const onAnchorChangeRef = useLatestRef(onAnchorChange);
  const onDoneRef = useLatestRef(onDone);
  const onIndexChangeRef = useLatestRef(onIndexChange);
  const onPreviewIndexChangeRef = useLatestRef(onPreviewIndexChange);

  const coordinates = useMemo(() => photos.map(toLngLat), [photos]);

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
      map.once('moveend', initialCameraGate.complete);
      initialCameraGate.markStarted();
      playbackRuntime.setPlaybackState(createInitialCameraPlaybackState(currentIndex));
      const initialCameraDuration = syncMapData(map, photos, currentIndex, true, mapTheme);
      if (initialCameraDuration === 0) {
        initialCameraGate.complete();
      } else {
        initialCameraGate.scheduleFallback(initialCameraDuration + 600);
      }
    });

    mapRef.current = map;

    return () => {
      stopPlaybackSideEffects();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapThemeRef.current === mapTheme) return;

    mapThemeRef.current = mapTheme;
    stopPlaybackSideEffects();

    map.setStyle(buildMapStyle(mapTheme));
    map.once('idle', () => {
      addFootprintSources(map);
      addFootprintLayers(map, mapTheme);
      syncMapData(map, photos, currentIndex, true, mapTheme);
      playbackRuntime.setPlaybackState(createHoldingPlaybackState(currentIndex));
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
        playbackRuntime.setPlaybackState(createHoldingPlaybackState(currentIndex));
      }
      publishAnchorForIndex(currentIndex);
      map.once('moveend', () => publishAnchorForIndex(currentIndex));
    } else {
      map.once('load', () => {
        run();
        if (!playingRef.current) {
          playbackRuntime.setPlaybackState(createHoldingPlaybackState(currentIndex));
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
      playbackRuntime.setPlaybackState(createPausedPlaybackState(currentIndex));
      publishAnchorForIndex(currentIndex);
    } else {
      map.once('load', () => {
        run();
        playbackRuntime.setPlaybackState(createPausedPlaybackState(currentIndex));
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
        playbackRuntime.setPlaybackState(createDonePlaybackState(fromIndex));
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

      playbackRuntime.setPlaybackState(createTransitionPlaybackState('leaving', transition, 0));
      lastPublishedAnchorRef.current = null;
      onAnchorChangeRef.current(null);
      showMovingVisualState(transition);
      playbackRuntime.scheduleNextStepPreview(showNextPopover);

      startTransitionAnimation(transition, () => {
        if (cancelled) return;

        showNextPopover();

        playbackRuntime.holdAtStep(speedRef.current, canContinuePlayback, () => {
          if (cancelled) return;

          if (nextIndex >= photos.length - 1) {
            playbackRuntime.setPlaybackState(createDonePlaybackState(nextIndex));
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
      stopPlaybackSideEffects();
    };
  }, [isPlaying, photos]);

  function publishStep(index: number) {
    if (index === 0) {
      hasRevealedInitialStepRef.current = true;
    }

    playbackRuntime.setPlaybackState(createHoldingPlaybackState(index));
    indexRef.current = index;
    onIndexChangeRef.current(index);
    publishAnchorForIndex(index);
  }

  function previewStep(index: number) {
    playbackRuntime.updatePlaybackState((state) => withActivePopoverIndex(state, index));
    onPreviewIndexChangeRef.current(index);
    publishAnchorForIndex(index);
  }

  function startPlaybackWhenReady(playNext: () => void, canContinuePlayback: () => boolean) {
    const startAfterInitialCameraSettles = (shouldRevealInitialStep: boolean) => {
      if (!canContinuePlayback()) return;

      playbackRuntime.setPlaybackState(createInitialRevealPlaybackState(indexRef.current));
      playbackRuntime.scheduleInitialStepSettle(() => {
        if (shouldRevealInitialStep) {
          publishStep(0);
        }

        playbackRuntime.scheduleInitialPopoverSettle(shouldRevealInitialStep, playNext);
      });
    };

    const map = mapRef.current;
    if (map && !initialCameraGate.hasCompleted()) {
      if (!initialCameraGate.hasStarted()) {
        map.once('load', () => startPlaybackWhenReady(playNext, canContinuePlayback));
      } else {
        initialCameraGate.onComplete(() => startAfterInitialCameraSettles(true));
      }
      return;
    }

    if (indexRef.current === 0) {
      startAfterInitialCameraSettles(!lastPublishedAnchorRef.current);
      return;
    }

    playNext();
  }

  function startTransitionAnimation(transition: StepTransition, onComplete: () => void) {
    const map = mapRef.current;
    if (!map) return;

    const cancelAnimation = startStepTransitionAnimation({
      map,
      photos,
      speed: speedRef.current,
      transition,
      canContinue: () => playingRef.current,
      onFrame: (rawProgress) => {
        playbackRuntime.updatePlaybackState((state) => withTransitionProgress(state, 'moving', rawProgress));
      },
      onPublishAnchor: publishActivePopoverAnchor,
      onComplete: () => {
        playbackRuntime.updatePlaybackState((state) => withTransitionProgress(state, 'arriving', 1));
        showHoldingVisualState(transition.toIndex);
        publishStep(transition.toIndex);
        onComplete();
      },
    });

    playbackRuntime.setAnimationCancel(cancelAnimation);
  }

  function stopPlaybackSideEffects() {
    playbackRuntime.stop();
    initialCameraGate.clearFallback();
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
    const activeIndex = playbackRuntime.getPlaybackContext().activePopoverIndex;
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
