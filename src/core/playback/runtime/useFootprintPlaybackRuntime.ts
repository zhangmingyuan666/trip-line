import { useCallback, useRef } from 'react';
import { holdDurationForSpeed } from '../../map/geometry';
import { buildPlaybackContext, createHoldingPlaybackState, type PlaybackContext, type PlaybackState } from '..';
import type { PlaybackSpeed } from '../../photo/types';
import { initialPopoverSettleDuration, initialStepSettleDuration, nextStepPreviewDelay } from '../timing';

export function useFootprintPlaybackRuntime(currentIndex: number, stepCount: number) {
  const playbackStateRef = useRef<PlaybackState>(createHoldingPlaybackState(currentIndex));
  const initialPlaybackTimeoutRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const nextPopoverTimeoutRef = useRef<number | null>(null);
  const animationCancelRef = useRef<(() => void) | null>(null);

  const clearAnimation = useCallback(() => {
    animationCancelRef.current?.();
    animationCancelRef.current = null;
  }, []);

  const setAnimationCancel = useCallback(
    (cancelAnimation: (() => void) | null) => {
      clearAnimation();
      animationCancelRef.current = cancelAnimation;
    },
    [clearAnimation],
  );

  const setPlaybackState = useCallback((state: PlaybackState) => {
    playbackStateRef.current = state;
  }, []);

  const getPlaybackContext = useCallback(
    (): PlaybackContext => buildPlaybackContext(playbackStateRef.current, stepCount),
    [stepCount],
  );

  const updatePlaybackState = useCallback((updater: (state: PlaybackState) => PlaybackState) => {
    playbackStateRef.current = updater(playbackStateRef.current);
  }, []);

  const scheduleNextStepPreview = useCallback((onPreview: () => void) => {
    nextPopoverTimeoutRef.current = window.setTimeout(() => {
      nextPopoverTimeoutRef.current = null;
      onPreview();
    }, nextStepPreviewDelay);
  }, []);

  const scheduleInitialStepSettle = useCallback((onSettled: () => void) => {
    initialPlaybackTimeoutRef.current = window.setTimeout(onSettled, initialStepSettleDuration);
  }, []);

  const scheduleInitialPopoverSettle = useCallback((shouldWait: boolean, onSettled: () => void) => {
    initialPlaybackTimeoutRef.current = window.setTimeout(() => {
      initialPlaybackTimeoutRef.current = null;
      onSettled();
    }, shouldWait ? initialPopoverSettleDuration : 0);
  }, []);

  const holdAtStep = useCallback(
    (speed: PlaybackSpeed, canContinue: () => boolean, onComplete: () => void) => {
      holdTimeoutRef.current = window.setTimeout(() => {
        holdTimeoutRef.current = null;
        if (canContinue()) {
          onComplete();
        }
      }, holdDurationForSpeed(speed));
    },
    [],
  );

  const stop = useCallback(() => {
    clearAnimation();

    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (nextPopoverTimeoutRef.current) {
      window.clearTimeout(nextPopoverTimeoutRef.current);
      nextPopoverTimeoutRef.current = null;
    }

    if (initialPlaybackTimeoutRef.current) {
      window.clearTimeout(initialPlaybackTimeoutRef.current);
      initialPlaybackTimeoutRef.current = null;
    }
  }, [clearAnimation]);

  return {
    getPlaybackContext,
    holdAtStep,
    scheduleInitialPopoverSettle,
    scheduleInitialStepSettle,
    scheduleNextStepPreview,
    setAnimationCancel,
    setPlaybackState,
    stop,
    updatePlaybackState,
  };
}
