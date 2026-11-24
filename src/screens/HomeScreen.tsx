import { Link, useNavigate } from 'react-router-dom';
import { useActiveWorkout } from '../app/useActiveWorkout';
import { WorkoutStateError } from '../data';
import { strings } from '../strings';
import { Button } from '../ui/Button';

export function HomeScreen() {
  const { state, pending, failed, run } = useActiveWorkout();
  const navigate = useNavigate();

  if (state.kind === 'loading') return <p>{strings.status.loading}</p>;
  if (state.kind === 'error') return <p>{strings.status.error}</p>;

  async function start() {
    const result = await run((store) => store.workouts.start());
    const alreadyActive =
      !result.ok &&
      result.error instanceof WorkoutStateError &&
      result.error.code === 'workout-already-active';
    if (result.ok || alreadyActive) navigate('/workout');
  }

  return (
    <div className="home">
      {state.value ? (
        <>
          <p>{strings.home.inProgress}</p>
          <Link className="button primary" to="/workout">
            {strings.home.resumeWorkout}
          </Link>
        </>
      ) : (
        <>
          <Button type="button" className="button primary" disabled={pending} onClick={start}>
            {strings.home.startWorkout}
          </Button>
          {failed && <p role="alert">{strings.home.startFailed}</p>}
        </>
      )}
      <Link className="button secondary" to="/exercises">
        {strings.home.exercises}
      </Link>
      <Link className="button secondary" to="/equipment">
        {strings.home.equipment}
      </Link>
    </div>
  );
}
