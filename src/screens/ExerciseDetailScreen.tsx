import { Link, useParams } from 'react-router-dom';
import { useDataStore } from '../app/DataStoreContext';
import { useStoreQuery } from '../app/useStoreQuery';
import { strings } from '../strings';
import { ExerciseImage } from '../ui/ExerciseImage';

function BackLink() {
  return (
    <Link className="back-link" to="/exercises">
      {strings.back}
    </Link>
  );
}

function joinLabels<T extends string>(values: T[], labelOf: Record<T, string>): string {
  return values.length === 0 ? strings.none : values.map((v) => labelOf[v]).join(', ');
}

function Detail({ id }: { id: string }) {
  const { store } = useDataStore();
  const state = useStoreQuery(() => store.exercises.get(id), [store, id]);

  if (state.kind === 'loading') return <p>{strings.status.loading}</p>;
  if (state.kind === 'error') return <p>{strings.status.error}</p>;
  if (!state.value) {
    return (
      <>
        <p>{strings.exerciseDetail.notFound}</p>
        <BackLink />
      </>
    );
  }

  const exercise = state.value;
  const fields = strings.exerciseDetail.fields;
  const labels = strings.labels;
  return (
    <>
      <BackLink />
      <div className="detail-images">
        <ExerciseImage exercise={exercise} imageRef={exercise.images.start} position="start" />
        <ExerciseImage exercise={exercise} imageRef={exercise.images.end} position="end" />
      </div>
      <h2>{exercise.name}</h2>
      {exercise.unilateral && <p>{strings.exerciseDetail.unilateral}</p>}
      <dl className="fields">
        <dt>{fields.type}</dt>
        <dd>{labels.exerciseType[exercise.type]}</dd>
        <dt>{fields.apparatus}</dt>
        <dd>{joinLabels(exercise.apparatus, labels.apparatus)}</dd>
        <dt>{fields.pattern}</dt>
        <dd>{labels.pattern[exercise.pattern]}</dd>
        <dt>{fields.primary}</dt>
        <dd>{joinLabels(exercise.primaryMuscles, labels.muscle)}</dd>
        <dt>{fields.secondary}</dt>
        <dd>{joinLabels(exercise.secondaryMuscles, labels.muscle)}</dd>
        <dt>{fields.phase}</dt>
        <dd>{labels.phase[exercise.defaultPhase]}</dd>
        <dt>{fields.rest}</dt>
        <dd>{strings.seconds(exercise.defaultRestSec)}</dd>
        <dt>{fields.leadIn}</dt>
        <dd>{strings.seconds(exercise.leadInSec)}</dd>
        <dt>{fields.endOffset}</dt>
        <dd>{strings.seconds(exercise.endOffsetSec)}</dd>
        <dt>{fields.loadDirection}</dt>
        <dd>{labels.loadDirection[exercise.defaultLoadDirection]}</dd>
      </dl>
      <p>{exercise.description}</p>
      {exercise.videoUrl && (
        <a className="video-link" href={exercise.videoUrl} target="_blank" rel="noreferrer">
          {strings.exerciseDetail.video}
        </a>
      )}
    </>
  );
}

export function ExerciseDetailScreen() {
  const { id = '' } = useParams();
  return <Detail key={id} id={id} />;
}
