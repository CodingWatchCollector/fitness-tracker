import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DataStore } from '../data';
import { strings } from '../strings';

export type Status = 'loading' | 'ready' | 'error' | 'reload-needed';

interface DataStoreState {
  store: DataStore;
  status: Status;
}

const StoreContext = createContext<DataStoreState | null>(null);

export function useDataStore(): DataStoreState {
  const state = useContext(StoreContext);
  if (!state) throw new Error('useDataStore needs a DataStoreProvider');
  return state;
}

export function DataStoreProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;
    store.ensureSeeded().then(
      () => {
        if (active) setStatus((s) => (s === 'loading' ? 'ready' : s));
      },
      () => {
        if (active) setStatus((s) => (s === 'loading' ? 'error' : s));
      },
    );
    const unsubscribe = store.onVersionChange(() => {
      if (active) setStatus('reload-needed');
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store]);

  const value = useMemo(() => ({ store, status }), [store, status]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function StatusGate({ children }: { children: ReactNode }) {
  const { status } = useDataStore();
  if (status === 'loading') return <p className="status-message">{strings.status.loading}</p>;
  if (status === 'error') return <p className="status-message">{strings.status.error}</p>;
  if (status === 'reload-needed') {
    return (
      <div className="status-message">
        <p>{strings.status.reloadNeeded}</p>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          {strings.status.reload}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
