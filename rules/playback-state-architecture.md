# Playback State Architecture Rules

## Priority

These rules define the preferred architecture for footprint playback changes. When playback behavior, map rendering, popover timing, camera motion, or step-to-step interactions are changed, this document takes priority over local convenience in existing code.

## Product Model

- Product language is step-to-step: users experience `Step1 -> Step2 -> Step3`.
- Engineering state must model both stable steps and active transitions.
- A transition must carry neighborhood context so renderers can reason about surrounding steps without hidden index reads.

## Three Layers

### 1. Playback State Machine

The state machine owns lifecycle. It decides phase changes, committed step, preview step, active transition, progress, and done state.

Allowed phase vocabulary:

```ts
type PlaybackPhase =
  | 'initialCamera'
  | 'initialReveal'
  | 'holding'
  | 'leaving'
  | 'moving'
  | 'arriving'
  | 'paused'
  | 'done';
```

Stable states are step-granular:

```ts
{ phase: 'holding', currentIndex: 2 }
```

Motion states are transition-granular:

```ts
{ phase: 'moving', fromIndex: 1, toIndex: 2, progress: 0.42 }
```

Frame-level details such as interpolated coordinates, active route coordinates, and camera values are derived render data. They must not become global React state unless user-facing controls need them.

### 2. Playback Context And Selectors

Every state must be converted into a complete context before renderers consume it:

```ts
type PlaybackContext = {
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
```

Renderer code should consume this context or selectors derived from it. Renderers should not independently infer `index - 1`, `index + 1`, or `index + 2` unless that logic lives in the context/selector layer.

### 3. Renderers And Presenters

Map rendering, popover presentation, camera motion, and preload behavior are consumers of context.

- Map renderer consumes route and step context, then updates MapLibre sources and camera.
- Popover presenter consumes active/leaving/preview context, then renders enter and exit states.
- Preloader consumes preview and neighborhood context.

Renderers must not directly own playback lifecycle. They may report explicit completion events such as `MOVE_DONE`, `HOLD_DONE`, or `INITIAL_CAMERA_DONE`.

## Module Ownership

- `pages/` owns route-level business composition and app/page state orchestration.
- `components/` owns reusable UI components and component-local presentation helpers.
- `enums/` owns finite UI/domain option sets and labels such as map themes and playback speed.
- `core/photo/` owns photo domain models, formatting, and preloading helpers.
- `core/map/` owns map geometry and map style construction.
- `core/playback/state/` owns phase/state/context types and state factories.
- `core/playback/selectors/` owns derived playback context and transition-neighborhood selectors.
- `core/playback/runtime/` owns playback timers, animation cancellation, mutable playback state refs, and initial camera gate state.
- `core/playback/animation/` owns per-frame step-to-step map motion, active route growth, moving point updates, and camera interpolation.
- `components/footprint-map/FootprintMap.tsx` should remain an orchestration component: create the map, wire effects, call renderer/runtime helpers, and publish anchors. Do not add new timer refs, RAF loops, or phase-state refs directly to this component.

## Communication Rules

Communication is one-way down and event-based up:

```text
PlaybackStateMachine
  -> PlaybackContext / selectors
  -> MapRenderer / PopoverPresenter / Preloader
```

Renderers may send events upward:

```ts
send({ type: 'MOVE_DONE' });
send({ type: 'HOLD_DONE' });
send({ type: 'PAUSE' });
```

They must not patch unrelated state directly.

## Current Behavior Contract

Behavior-preserving refactors must keep these timings unless the product change explicitly says otherwise:

- Initial camera settles before first popover.
- Initial step reveal delay: `450ms`.
- Initial popover settle delay: `1000ms`.
- Next popover preview delay after movement starts: `100ms`.
- Hold duration by speed: slow `1100ms`, normal `700ms`, fast `400ms`.
- Popover enter animation: `240ms`.
- Popover exit animation: `220ms`.
- Movement duration remains distance-based: `1200ms` to `6200ms`.
- Long-distance camera lead and movement delay remain separate from close-distance values.

## Visual State Contract

- `currentIndex` is committed progress. It must update only when a destination step is reached.
- `previewIndex` may move ahead of `currentIndex` for popover preview.
- `route-active` is source-driven and grows per frame while moving.
- `route-past`, `route-upcoming`, and point sources are reassigned at phase boundaries.
- Footprint layer opacity transitions stay disabled unless explicitly revalidated.
- `point-current` remains the single visual point for both holding and moving.

## Future Interaction Requirements

The architecture must support interruption events such as retreat, jump, pause, and resume. Any transition state should preserve enough information to derive:

- active segment,
- progress,
- current rendered coordinate,
- previous and next neighborhood,
- current preview/popover target.

Do not add new interaction behavior by reading scattered refs from render code. Add an event to the state machine and derive renderer output from the resulting context.
