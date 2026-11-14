import { Link } from 'react-router-dom';
import { useDataStore } from '../app/DataStoreContext';
import { useStoreQuery } from '../app/useStoreQuery';
import { bundledImageUrl } from '../data';
import { strings } from '../strings';
import { PatternIcon } from '../ui/PatternIcon';

export function ExerciseListScreen() {
  const { store } = useDataStore();
  const state = useStoreQuery(() => store.exercises.list(), [store]);

  if (state.kind === 'loading') return <p>{strings.status.loading}</p>;
  if (state.kind === 'error') return <p>{strings.status.error}</p>;

  return (
    <ul className="exercise-list" aria-label={strings.exerciseList.title}>
      {state.value.map((exercise) => (
        <li key={exercise.id}>
          <Link className="exercise-row" to={`/exercises/${exercise.id}`}>
            {exercise.images.start ? (
              <img className="thumb" alt="" src={bundledImageUrl(exercise.images.start.key)} />
            ) : (
              <span className="thumb" aria-hidden="true">
                <PatternIcon pattern={exercise.pattern} />
              </span>
            )}
            <span className="exercise-row-text">
              <span>{exercise.name}</span>
              <span className="exercise-row-meta">
                {strings.exerciseList.meta(
                  strings.labels.exerciseType[exercise.type],
                  strings.labels.pattern[exercise.pattern],
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
