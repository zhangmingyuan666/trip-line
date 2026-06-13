import type { StepTransition } from '../state/types';

export function getNextStepTransition(currentIndex: number, stepCount: number): StepTransition | null {
  const fromIndex = boundedIndex(currentIndex, stepCount);
  const toIndex = boundedIndex(currentIndex + 1, stepCount);
  if (fromIndex === null || toIndex === null) return null;

  return { fromIndex, toIndex };
}

function boundedIndex(index: number | null | undefined, stepCount: number): number | null {
  if (index === null || index === undefined) return null;
  if (!Number.isInteger(index)) return null;
  if (index < 0 || index >= stepCount) return null;

  return index;
}
