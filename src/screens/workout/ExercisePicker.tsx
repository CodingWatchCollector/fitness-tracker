import { useId, useState } from 'react';
import { useDataStore } from '../../app/DataStoreContext';
import { useStoreQuery } from '../../app/useStoreQuery';
import type { Exercise } from '../../data';
import { strings } from '../../strings';
import { Button } from '../../ui/Button';

function ExerciseList({
  label,
  exercises,
  disabled,
  noteId,
  onPick,
}: {
  label: string;
  exercises: Exercise[];
  disabled: boolean;
  noteId: string;
  onPick(exerciseId: string): void;
}) {
  return (
    <ul className="picker-list" aria-label={label}>
      {exercises.map((exercise) => {
        const timeBased = exercise.type !== 'rep';
        return (
          <li key={exercise.id}>
            <Button
              type="button"
              className="button picker-button"
              disabled={disabled || timeBased}
              aria-describedby={timeBased ? noteId : undefined}
              onClick={() => onPick(exercise.id)}
            >
              {exercise.name}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function ExercisePicker({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick(exerciseId: string): void;
}) {
  const { store } = useDataStore();
  const state = useStoreQuery(
    () => Promise.all([store.exercises.list(), store.exercises.recent()]),
    [store],
  );
  const [query, setQuery] = useState('');
  const noteId = useId();

  if (state.kind === 'loading') return <p>{strings.status.loading}</p>;
  if (state.kind === 'error') return <p>{strings.status.error}</p>;

  const [all, recent] = state.value;
  const needle = query.trim().toLocaleLowerCase('en');
  const searching = needle !== '';
  const shown = searching
    ? all.filter((e) => e.name.toLocaleLowerCase('en').includes(needle))
    : all;
  const favorites = all.filter((e) => e.favorite);
  const list = (label: string, exercises: Exercise[]) => (
    <ExerciseList
      label={label}
      exercises={exercises}
      disabled={busy}
      noteId={noteId}
      onPick={onPick}
    />
  );

  return (
    <div className="picker">
      <input
        type="search"
        className="picker-search"
        aria-label={strings.picker.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {!searching && favorites.length > 0 && (
        <>
          <h2>{strings.picker.favorites}</h2>
          {list(strings.picker.favorites, favorites)}
        </>
      )}
      {!searching && recent.length > 0 && (
        <>
          <h2>{strings.picker.recent}</h2>
          {list(strings.picker.recent, recent)}
        </>
      )}
      {!searching && <h2>{strings.picker.all}</h2>}
      {shown.length === 0 ? <p>{strings.picker.noMatches}</p> : list(strings.picker.all, shown)}
      {shown.some((e) => e.type !== 'rep') && (
        <p id={noteId} className="picker-note">
          {strings.picker.timeBasedLater}
        </p>
      )}
    </div>
  );
}
