import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveWorkout, DataStore } from '../data';
import { useDataStore } from './DataStoreContext';
import type { QueryState } from './useStoreQuery';

export type RunResult = { ok: true } | { ok: false; error: unknown };

export function useActiveWorkout() {
  const { store } = useDataStore();
  const [state, setState] = useState<QueryState<ActiveWorkout | null>>({ kind: 'loading' });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    store.workouts
      .current()
      .then((value) => {
        if (active) setState({ kind: 'ready', value });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [store]);

  const run = useCallback(
    async (intent: (store: DataStore) => Promise<ActiveWorkout | null>): Promise<RunResult> => {
      if (inFlight.current) return { ok: false, error: 'busy' };
      inFlight.current = true;
      setPending(true);
      try {
        const value = await intent(store);
        setState({ kind: 'ready', value });
        setFailed(false);
        return { ok: true };
      } catch (error) {
        setFailed(true);
        try {
          setState({ kind: 'ready', value: await store.workouts.current() });
        } catch {
          setState({ kind: 'error' });
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
