import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DataStoreProvider } from './app/DataStoreContext';
import type { DataStore } from './data';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen';
import { ExerciseListScreen } from './screens/ExerciseListScreen';
import { Layout } from './ui/Layout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ExerciseListScreen />} />
        <Route path="exercises/:id" element={<ExerciseDetailScreen />} />
      </Route>
    </Routes>
  );
}

export function App({ store }: { store: DataStore }) {
  return (
    <BrowserRouter>
      <DataStoreProvider store={store}>
        <AppRoutes />
      </DataStoreProvider>
    </BrowserRouter>
  );
}
