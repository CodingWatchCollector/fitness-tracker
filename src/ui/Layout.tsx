import { Link, Outlet, useMatch } from 'react-router-dom';
import { StatusGate, useDataStore } from '../app/DataStoreContext';
import { useActiveWorkout } from '../app/useActiveWorkout';
import { strings } from '../strings';

function WorkoutLink() {
  const { state } = useActiveWorkout();
  if (state.kind !== 'ready' || state.value === null) return null;
  return (
    <Link className="header-workout-link" to="/workout">
      {strings.header.workoutInProgress}
    </Link>
  );
}

export function Layout() {
  const { status } = useDataStore();
  const onExercises = useMatch('/exercises/*') !== null;
  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          <Link to="/">{strings.appName}</Link>
        </h1>
        {status === 'ready' && onExercises && <WorkoutLink />}
      </header>
      <main className="app-main">
        <StatusGate>
          <Outlet />
        </StatusGate>
      </main>
    </>
  );
}
