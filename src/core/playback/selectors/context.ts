import type { PlaybackContext, PlaybackState, StablePlaybackState, TransitionPlaybackState } from '../state/types';

export function buildPlaybackContext(state: PlaybackState, stepCount: number): PlaybackContext {
  if (isTransitionPlaybackState(state)) {
    return buildTransitionContext(state, stepCount);
  }

  return buildStableContext(state, stepCount);
}

function buildStableContext(state: StablePlaybackState, stepCount: number): PlaybackContext {
  const currentIndex = boundedIndex(state.currentIndex, stepCount) ?? 0;
  const nextIndex = boundedIndex(currentIndex + 1, stepCount);

  return {
    phase: state.phase,
    currentIndex,
    previewIndex: state.activePopoverIndex ?? currentIndex,
    activePopoverIndex: boundedIndex(state.activePopoverIndex, stepCount),
    fromIndex: null,
    toIndex: null,
    previousIndex: boundedIndex(currentIndex - 1, stepCount),
    nextIndex,
    afterNextIndex: nextIndex === null ? null : boundedIndex(nextIndex + 1, stepCount),
    progress: 0,
  };
}

function buildTransitionContext(state: TransitionPlaybackState, stepCount: number): PlaybackContext {
  const fromIndex = boundedIndex(state.fromIndex, stepCount) ?? 0;
  const toIndex = boundedIndex(state.toIndex, stepCount);

  return {
    phase: state.phase,
    currentIndex: fromIndex,
    previewIndex: state.activePopoverIndex ?? fromIndex,
    activePopoverIndex: boundedIndex(state.activePopoverIndex, stepCount),
    fromIndex,
    toIndex,
    previousIndex: boundedIndex(fromIndex - 1, stepCount),
    nextIndex: toIndex === null ? null : boundedIndex(toIndex + 1, stepCount),
    afterNextIndex: toIndex === null ? null : boundedIndex(toIndex + 2, stepCount),
    progress: state.progress,
  };
}

function isTransitionPlaybackState(state: PlaybackState): state is TransitionPlaybackState {
  return state.phase === 'leaving' || state.phase === 'moving' || state.phase === 'arriving';
}

function boundedIndex(index: number | null | undefined, stepCount: number): number | null {
  if (index === null || index === undefined) return null;
  if (!Number.isInteger(index)) return null;
  if (index < 0 || index >= stepCount) return null;

  return index;
}
