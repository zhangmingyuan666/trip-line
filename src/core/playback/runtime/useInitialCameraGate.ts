import { useCallback, useRef } from 'react';

export function useInitialCameraGate() {
  const hasStartedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const waitersRef = useRef<Array<() => void>>([]);

  const clearFallback = useCallback(() => {
    if (!timeoutRef.current) return;

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const complete = useCallback(() => {
    if (hasCompletedRef.current) return;

    hasCompletedRef.current = true;
    clearFallback();

    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((waiter) => waiter());
  }, [clearFallback]);

  const scheduleFallback = useCallback(
    (duration: number) => {
      clearFallback();
      timeoutRef.current = window.setTimeout(complete, duration);
    },
    [clearFallback, complete],
  );

  const onComplete = useCallback(
    (callback: () => void) => {
      if (hasCompletedRef.current) {
        callback();
        return;
      }

      waitersRef.current.push(callback);
    },
    [],
  );

  return {
    clearFallback,
    complete,
    hasCompleted: () => hasCompletedRef.current,
    hasStarted: () => hasStartedRef.current,
    markStarted: () => {
      hasStartedRef.current = true;
    },
    onComplete,
    scheduleFallback,
  };
}
