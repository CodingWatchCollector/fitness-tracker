import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AlertsProvider, type Alerts } from '../app/alerts';
import { ClockProvider } from '../app/clock';
import { DataStoreProvider } from '../app/DataStoreContext';
import { WakeLockProvider, type WakeLockPort } from '../app/wakeLock';
import type { DataStore } from '../data';
import { fakeWakeLock, recordingAlerts } from './fake-ports';
import { LocationProbe } from './location-probe';
import type { TestClock } from './test-clock';

export function renderApp(
  store: DataStore,
  clock: TestClock,
  route: string,
  ports: { alerts?: Alerts; wakeLock?: WakeLockPort } = {},
) {
  const alerts = ports.alerts ?? recordingAlerts().alerts;
  const wakeLock = ports.wakeLock ?? fakeWakeLock('grant').port;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ClockProvider clock={clock}>
        <AlertsProvider alerts={alerts}>
          <WakeLockProvider port={wakeLock}>
            <DataStoreProvider store={store}>
              <AppRoutes />
              <LocationProbe />
            </DataStoreProvider>
          </WakeLockProvider>
        </AlertsProvider>
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
