import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveWorkout, DataStore } from '../data';
import { useClock } from './clock';
import { useDataStore } from './DataStoreContext';
import type { QueryState } from './useStoreQuery';

export type RunResult = { ok: true } | { ok: false; error: unknown };

const TICK_RETRY_AFTER_MS = 5_000;

export function useActiveWorkout() {
  const { store } = useDataStore();
  const clock = useClock();
  const [state, setState] = useState<QueryState<ActiveWorkout | null>>({ kind: 'loading' });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    const mine = generation.current;
    store.workouts
      .current()
      .then((value) => {
        if (active && mine === generation.current) setState({ kind: 'ready', value });
      })
      .catch(() => {
        if (active && mine === generation.current) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [store]);

  // A failed re-read keeps the current state: the next trigger tries again.
  const reread = useCallback((): Promise<boolean> => {
    generation.current += 1;
    const mine = generation.current;
    return store.workouts
      .current()
      .then((value) => {
        if (mounted.current && mine === generation.current) setState({ kind: 'ready', value });
        return true;
      })
      .catch(() => false);
  }, [store]);

  const autoCloseAt = state.kind === 'ready' && state.value ? state.value.autoCloseAt : null;

  useEffect(() => {
    if (autoCloseAt === null) return;
    let requested = false;
    let retryAt = autoCloseAt;
    let failedBefore = false;
    return clock.subscribe(() => {
      if (requested || clock.now() < retryAt) return;
      if (document.visibilityState !== 'visible' || inFlight.current) return;
      requested = true;
      void reread().then((ok) => {
        if (ok) return;
        requested = false;
        retryAt = (failedBefore ? clock.now() : autoCloseAt) + TICK_RETRY_AFTER_MS;
        failedBefore = true;
      });
    });
  }, [clock, autoCloseAt, reread]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !inFlight.current) void reread();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [state.kind, reread]);

  const run = useCallback(
    async (intent: (store: DataStore) => Promise<ActiveWorkout | null>): Promise<RunResult> => {
      if (inFlight.current) return { ok: false, error: 'busy' };
      inFlight.current = true;
      generation.current += 1;
      const mine = generation.current;
      setPending(true);
      try {
        const value = await intent(store);
        if (mine === generation.current) setState({ kind: 'ready', value });
        setFailed(false);
        return { ok: true };
      } catch (error) {
        setFailed(true);
        try {
          const value = await store.workouts.current();
          if (mine === generation.current) setState({ kind: 'ready', value });
        } catch {
          if (mine === generation.current) setState({ kind: 'error' });
        }
        return { ok: false, error };
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [store],
  );

  return { state, pending, failed, run };
}
