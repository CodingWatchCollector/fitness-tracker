import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ClockProvider, browserClock, type Clock } from './app/clock';
import { DataStoreProvider } from './app/DataStoreContext';
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

export function App({ store, clock = browserClock }: { store: DataStore; clock?: Clock }) {
  return (
    <BrowserRouter>
      <ClockProvider clock={clock}>
        <DataStoreProvider store={store}>
          <AppRoutes />
        </DataStoreProvider>
      </ClockProvider>
    </BrowserRouter>
  );
}
