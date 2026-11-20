import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AlertsProvider, browserAlerts, type Alerts } from './app/alerts';
import { ClockProvider, browserClock, type Clock } from './app/clock';
import { DataStoreProvider } from './app/DataStoreContext';
import { WakeLockProvider, browserWakeLock, type WakeLockPort } from './app/wakeLock';
import type { DataStore } from './data';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen';
import { ExerciseListScreen } from './screens/ExerciseListScreen';
import { HomeScreen } from './screens/HomeScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { Layout } from './ui/Layout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen />} />
        <Route path="exercises" element={<ExerciseListScreen />} />
        <Route path="exercises/:id" element={<ExerciseDetailScreen />} />
        <Route path="workout" element={<WorkoutScreen />} />
      </Route>
    </Routes>
  );
}

export function App({
  store,
  clock = browserClock,
  alerts = browserAlerts,
  wakeLock = browserWakeLock,
}: {
  store: DataStore;
  clock?: Clock;
  alerts?: Alerts;
  wakeLock?: WakeLockPort;
}) {
  return (
    <BrowserRouter>
      <ClockProvider clock={clock}>
        <AlertsProvider alerts={alerts}>
          <WakeLockProvider port={wakeLock}>
            <DataStoreProvider store={store}>
              <AppRoutes />
            </DataStoreProvider>
          </WakeLockProvider>
        </AlertsProvider>
      </ClockProvider>
    </BrowserRouter>
  );
}
