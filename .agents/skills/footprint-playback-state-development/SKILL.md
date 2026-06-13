---
name: footprint-playback-state-development
description: Use when developing, refactoring, or reviewing the anniversary footprint playback state machines, 状态机, Step 过渡, Step-to-Step transitions, derived playback context, map/popover/camera render state, 回退, 跳转, 暂停/恢复 interactions, or related files under src/core/playback.
---

# Footprint Playback State Development

Use this skill before changing playback state, transition timing, map motion, popover lifecycle, camera behavior, or interruption features in this repository.

## First Read

Read `rules/playback-state-architecture.md` first. Treat it as the source of truth for architecture and behavior-preserving constraints.

Then inspect only the relevant implementation layer:

- `src/core/playback/state/`: phase vocabulary, state types, and state factories.
- `src/core/playback/selectors/`: derived `PlaybackContext` and transition neighborhood.
- `src/core/playback/runtime/`: timers, cancellation, mutable state refs, and upward event orchestration.
- `src/core/playback/animation/`: per-frame route growth, moving point updates, and camera interpolation.
- `src/components/footprint-map/`: MapLibre wiring and presentation-only map helpers.
- `src/components/photo-popover/`: popover rendering, anchor layout, and enter/exit presentation.

## State Machine Layers

Keep three responsibilities separate:

1. Step relationship machine: models product intent such as `Step1 -> Step2`, retreat, jump, pause, and resume. It should know the target relationship, not MapLibre details.
2. Playback lifecycle machine: models phases such as `initialCamera`, `initialReveal`, `holding`, `leaving`, `moving`, `arriving`, `paused`, and `done`. It owns committed step, active transition, progress, preview target, and done state.
3. Derived render machine: converts playback context into map, camera, popover, and preload instructions. It must not decide lifecycle transitions.

If a change crosses layers, add an event or selector instead of letting a lower layer patch unrelated state.

## Per-Layer Cautions

Step relationship machine:

- Think in product relationships: from which step, to which step, in which direction, and why.
- Guard bounds, direction, and interruption policy here before lower layers receive work.
- Do not read map coordinates, popover anchors, or camera state here.

Playback lifecycle machine:

- Own phase, committed `currentIndex`, transition `{ fromIndex, toIndex }`, `progress`, preview target, timers, and cancellation.
- Clear hold timeout, next-preview timeout, initial timeout, and animation RAF before accepting an interrupt.
- Keep `currentIndex` stable until arrival is committed. Use preview fields for destination UI during motion.
- Treat `leaving`, `moving`, and `arriving` as transition states, not step states.

Derived render machine:

- Derive map, camera, popover, and preload output from `PlaybackContext`.
- Keep frame coordinates, active route geometry, camera interpolation, and popover placement out of global lifecycle state.
- Presentation helpers may keep component-local enter/exit snapshots, but they must not decide what step comes next.

## Development Rules

- Add or change phase fields in `state/types.ts` first, then update factories and selectors in the same change.
- Do not let React components infer neighbors with scattered `index - 1`, `index + 1`, or `index + 2`; add that shape to selectors.
- Do not add timer refs, RAF loops, or lifecycle refs directly to `FootprintMap.tsx`; place them in `core/playback/runtime` or `core/playback/animation`.
- Do not store frame-level coordinates, camera values, or active route coordinates in global React state unless user controls need to observe them.
- Preserve `currentIndex` as committed progress. During movement, destination preview belongs in `previewIndex` or `activePopoverIndex`, not `currentIndex`.
- Keep renderers event-based upward: examples are `MOVE_DONE`, `HOLD_DONE`, `PAUSE`, `RETREAT`, `JUMP`, and `RESUME`.
- Keep MapLibre source and layer mutations in map/animation helpers. Components should wire effects and pass context.
- Preserve behavior contract timings unless the user explicitly asks for product behavior changes.

## Adding A State Or Interaction

Use this sequence:

1. Name the product-level event in step terms, such as retreat from the current rendered position to the previous step.
2. Decide which lifecycle phases can receive the event and what cancellation is required.
3. Extend `PlaybackState` and factories only if the existing shape cannot represent the behavior.
4. Extend `buildPlaybackContext` or a selector so renderers get complete data without ad hoc index reads.
5. Update runtime to translate timers, animation completion, and user events into state transitions.
6. Update animation or presentation helpers to consume context; do not duplicate lifecycle logic there.
7. Verify build and manually reason through `Step1 -> Step2 -> Step3`, including initial reveal, leaving, moving, arriving, hold, and done.

## Review Checklist

Before finishing, check:

- Can `Step1 -> Step2 -> Step3` still be described from state alone?
- Does every renderer consume `PlaybackContext` or explicit props derived from it?
- Are cancellation paths clear for hold timeout, next preview timeout, initial timeout, and animation RAF?
- Are pause/retreat/jump future paths still possible without reading scattered component refs?
- Did the change avoid moving business logic into reusable UI components?
- Did `npm run build` pass?
