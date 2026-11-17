import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { ClockProvider } from '../app/clock';
import { DataStoreProvider } from '../app/DataStoreContext';
import type { DataStore } from '../data';
import { LocationProbe } from './location-probe';
import type { TestClock } from './test-clock';

export function renderApp(store: DataStore, clock: TestClock, route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ClockProvider clock={clock}>
        <DataStoreProvider store={store}>
          <AppRoutes />
          <LocationProbe />
        </DataStoreProvider>
      </ClockProvider>
    </MemoryRouter>,
  );
}

export function withWorkouts(
  store: DataStore,
  overrides: Partial<DataStore['workouts']>,
): DataStore {
  return { ...store, workouts: { ...store.workouts, ...overrides } };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
