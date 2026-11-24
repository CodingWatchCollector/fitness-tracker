import { render } from '@testing-library/react';
import { useEffect, useReducer } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AlertsProvider, type Alerts } from '../app/alerts';
import { ClockProvider } from '../app/clock';
import { DataStoreProvider } from '../app/DataStoreContext';
import { WakeLockProvider, type WakeLockPort } from '../app/wakeLock';
import type { ActiveWorkout, DataStore } from '../data';
import { fakeWakeLock, recordingAlerts } from './fake-ports';
import { LocationProbe } from './location-probe';
import { registerFlush } from './settle';
import type { TestClock } from './test-clock';

function EffectFlush() {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => registerFlush(forceUpdate), [forceUpdate]);
  return null;
}

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
              <EffectFlush />
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

export function withEquipment(
  store: DataStore,
  overrides: Partial<DataStore['equipment']>,
): DataStore {
  return { ...store, equipment: { ...store.equipment, ...overrides } };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export function countingWorkouts(
  store: DataStore,
  impl?: (call: number) => Promise<ActiveWorkout | null>,
  overrides: Partial<DataStore['workouts']> = {},
) {
  let count = 0;
  const wrapped = withWorkouts(store, {
    ...overrides,
    current: () => {
      count += 1;
      return impl ? impl(count) : store.workouts.current();
    },
  });
  return { store: wrapped, calls: () => count };
}
