import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useRestAlerts } from '../app/alerts';
import { useWakeLock } from '../app/wakeLock';
import { useActiveWorkout } from '../app/useActiveWorkout';
import type { ActiveWorkout } from '../data';
import { strings } from '../strings';
import { Button } from '../ui/Button';
import { restInputOf } from '../workout/restAlerts';
import { ExercisePicker } from './workout/ExercisePicker';
import {
  OverallTimer,
  ReadyPanel,
  RepsPanel,
  RestPanel,
  SetRunningPanel,
} from './workout/StepPanels';

function stepPanel(
  active: ActiveWorkout,
  busy: boolean,
  run: ReturnType<typeof useActiveWorkout>['run'],
) {
  const { step } = active;
  if (step.kind === 'picking') {
    return (
      <ExercisePicker
        busy={busy}
        onPick={(id) => {
          run((s) => s.workouts.openBlock(id));
        }}
      />
    );
  }
  const block = active.blocks.find((b) => b.block.id === step.blockId);
  if (!block) return null;
  const plannedRest = (sec: number) => {
    run((s) => s.workouts.setPlannedRest(step.blockId, sec));
  };
  const endBlock = () => {
    run((s) => s.workouts.endBlock(step.blockId));
  };
  const setNumber = (setId: string) => block.sets.findIndex((set) => set.id === setId) + 1;

  switch (step.kind) {
    case 'ready':
      return (
        <ReadyPanel
          active={block}
          busy={busy}
          onStart={() => {
            run((s) => s.workouts.startSet(step.blockId));
          }}
          onEndBlock={endBlock}
          onPlannedRest={plannedRest}
        />
      );
    case 'set-running':
      return (
        <SetRunningPanel
          active={block}
          busy={busy}
          setNumber={setNumber(step.setId)}
          startedAt={step.startedAt}
          onDone={() => {
            run((s) => s.workouts.doneSet(step.setId));
          }}
        />
      );
    case 'reps-pending':
      return (
        <RepsPanel
          active={block}
          busy={busy}
          setId={step.setId}
          setNumber={setNumber(step.setId)}
          suggestion={step.repsSuggestion}
          endedAt={step.endedAt}
          onSave={(reps) => {
            run((s) => s.workouts.saveReps(step.setId, reps));
          }}
          onPlannedRest={plannedRest}
        />
      );
    case 'resting':
      return (
        <RestPanel
          active={block}
          busy={busy}
          endedAt={step.endedAt}
          onStart={() => {
            run((s) => s.workouts.startSet(step.blockId));
          }}
          onEndBlock={endBlock}
          onPlannedRest={plannedRest}
        />
      );
  }
}

export function WorkoutScreen() {
  const { state, pending, failed, run } = useActiveWorkout();
  const [confirming, setConfirming] = useState(false);
  const finishRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wasConfirming = useRef(false);
  const value = state.kind === 'ready' ? state.value : null;
  useWakeLock(value !== null);
  const { flashing } = useRestAlerts(value ? restInputOf(value.step) : null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirming) {
      if (!dialog.open) dialog.showModal();
      cancelRef.current?.focus();
    } else {
      if (dialog.open) dialog.close();
      if (wasConfirming.current) finishRef.current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

  if (state.kind === 'loading') return <p>{strings.status.loading}</p>;
  if (state.kind === 'error') return <p>{strings.status.error}</p>;
  if (state.value === null) return <Navigate to="/" replace />;

  const active = state.value;
  const unsaved = active.step.kind === 'set-running' || active.step.kind === 'reps-pending';

  return (
    <div className="workout">
      {flashing && <div className="rest-flash" aria-hidden="true" />}
      <div className="workout-bar">
        <OverallTimer startedAt={active.workout.startedAt} />
        <Button
          type="button"
          className="button secondary"
          ref={finishRef}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          {strings.workout.finish}
        </Button>
      </div>
      {failed && <p role="alert">{strings.workout.actionFailed}</p>}
      {stepPanel(active, pending, run)}
      <dialog
        ref={dialogRef}
        aria-labelledby="finish-title"
        className="dialog"
        onClose={() => setConfirming(false)}
      >
        {confirming && (
          <>
            <h2 id="finish-title">{strings.workout.finishDialog.title}</h2>
            {unsaved && <p>{strings.workout.finishDialog.unsaved}</p>}
            <Button
              type="button"
              className="button primary"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                run((s) => s.workouts.finish());
              }}
            >
              {strings.workout.finishDialog.confirm}
            </Button>
            <button
              type="button"
              className="button secondary"
              ref={cancelRef}
              onClick={() => setConfirming(false)}
            >
              {strings.workout.finishDialog.cancel}
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
