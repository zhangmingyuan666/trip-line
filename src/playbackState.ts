export type PlaybackPhase =
  | 'initialCamera'
  | 'initialReveal'
  | 'holding'
  | 'leaving'
  | 'moving'
  | 'arriving'
  | 'paused'
  | 'done';

export type StepTransition = {
  fromIndex: number;
  toIndex: number;
};

type StablePlaybackState = {
  phase: 'initialCamera' | 'initialReveal' | 'holding' | 'paused' | 'done';
  currentIndex: number;
  activePopoverIndex: number | null;
};

type TransitionPlaybackState = StepTransition & {
  phase: 'leaving' | 'moving' | 'arriving';
  progress: number;
  activePopoverIndex: number | null;
};

export type PlaybackState = StablePlaybackState | TransitionPlaybackState;

export type PlaybackContext = {
  phase: PlaybackPhase;
  currentIndex: number;
  previewIndex: number;
  activePopoverIndex: number | null;
  fromIndex: number | null;
  toIndex: number | null;
  previousIndex: number | null;
  nextIndex: number | null;
  afterNextIndex: number | null;
  progress: number;
};

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
  phase: 'leaving' | 'moving' | 'arriving',
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

export function getNextStepTransition(currentIndex: number, stepCount: number): StepTransition | null {
  const fromIndex = boundedIndex(currentIndex, stepCount);
  const toIndex = boundedIndex(currentIndex + 1, stepCount);
  if (fromIndex === null || toIndex === null) return null;

  return { fromIndex, toIndex };
}

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
