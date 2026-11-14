import { useEffect, useState, type DependencyList } from 'react';

export type QueryState<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; value: T };

export function useStoreQuery<T>(query: () => Promise<T>, deps: DependencyList): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    query()
      .then((value) => {
        if (active) setState({ kind: 'ready', value });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller owns the dependency list
  }, deps);

  return state;
}
