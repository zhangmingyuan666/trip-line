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

export type StablePlaybackState = {
  phase: 'initialCamera' | 'initialReveal' | 'holding' | 'paused' | 'done';
  currentIndex: number;
  activePopoverIndex: number | null;
};

export type TransitionPlaybackState = StepTransition & {
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
