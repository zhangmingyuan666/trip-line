import type { PlaybackState, StepTransition, TransitionPlaybackState } from './types';

export function createInitialCameraPlaybackState(currentIndex: number): PlaybackState {
  return {
    phase: 'initialCamera',
    currentIndex,
    activePopoverIndex: null,
  };
}

export function createInitialRevealPlaybackState(currentIndex: number): PlaybackState {
  return {
    phase: 'initialReveal',
    currentIndex,
    activePopoverIndex: null,
  };
}

export function createHoldingPlaybackState(currentIndex: number): PlaybackState {
  return {
    phase: 'holding',
    currentIndex,
    activePopoverIndex: currentIndex,
  };
}

export function createPausedPlaybackState(currentIndex: number): PlaybackState {
  return {
    phase: 'paused',
    currentIndex,
    activePopoverIndex: currentIndex,
  };
}

export function createDonePlaybackState(currentIndex: number): PlaybackState {
  return {
    phase: 'done',
    currentIndex,
    activePopoverIndex: currentIndex,
  };
}

export function createTransitionPlaybackState(
  phase: TransitionPlaybackState['phase'],
  transition: StepTransition,
  progress: number,
  activePopoverIndex: number | null = null,
): PlaybackState {
  return {
    phase,
    fromIndex: transition.fromIndex,
    toIndex: transition.toIndex,
    progress,
    activePopoverIndex,
  };
}

export function withActivePopoverIndex(state: PlaybackState, activePopoverIndex: number | null): PlaybackState {
  return {
    ...state,
    activePopoverIndex,
  };
}

export function withTransitionProgress(
  state: PlaybackState,
  phase: 'moving' | 'arriving',
  progress: number,
): PlaybackState {
  if (!isTransitionPlaybackState(state)) return state;

  return {
    ...state,
    phase,
    progress,
  };
}

function isTransitionPlaybackState(state: PlaybackState): state is TransitionPlaybackState {
  return state.phase === 'leaving' || state.phase === 'moving' || state.phase === 'arriving';
}
