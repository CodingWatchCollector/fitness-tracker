import { useState } from 'react';
import { useNow } from '../../app/clock';
import { REPS_MAX, isSetSaved, type ActiveBlock } from '../../data';
import { strings } from '../../strings';
import { Button } from '../../ui/Button';
import { elapsedSec, restView } from '../../workout/machine';
import { Stepper } from './Stepper';

const REST_MAX_UI_SEC = 600;
const REST_STEP_SEC = 15;

export function OverallTimer({ startedAt }: { startedAt: number }) {
  const now = useNow();
  return (
    <span role="timer" className="timer" aria-label={strings.workout.overallTimer}>
      {strings.clock(elapsedSec(startedAt, now))}
    </span>
  );
}

function SetTimer({ startedAt }: { startedAt: number }) {
  const now = useNow();
  return (
    <span role="timer" className="timer timer-large" aria-label={strings.workout.setTimer}>
      {strings.clock(elapsedSec(startedAt, now))}
    </span>
  );
}

function RestTimer({ endedAt, plannedRestSec }: { endedAt: number; plannedRestSec: number }) {
  const now = useNow();
  const { phase, seconds } = restView(endedAt, plannedRestSec, now);
  const text = strings.clock(seconds);
  return (
    <div className={`rest-timer rest-${phase}`}>
      <span className="rest-label">{strings.workout.restPhase[phase]}</span>
      <span role="timer" className="timer timer-large" aria-label={strings.workout.restTimer}>
        {phase === 'overtime' ? strings.workout.overtime(text) : text}
      </span>
    </div>
  );
}

function PlannedRestStepper({
  value,
  busy,
  onChange,
}: {
  value: number;
  busy: boolean;
  onChange(sec: number): void;
}) {
  return (
    <Stepper
      outputLabel={strings.workout.plannedRest}
      display={strings.clock(value)}
      lessLabel={strings.workout.restLess}
      moreLabel={strings.workout.restMore}
      lessDisabled={busy || value <= 0}
      moreDisabled={busy || value >= REST_MAX_UI_SEC}
      onLess={() => onChange(Math.max(0, value - REST_STEP_SEC))}
      onMore={() => onChange(Math.min(REST_MAX_UI_SEC, value + REST_STEP_SEC))}
    />
  );
}

interface PanelProps {
  active: ActiveBlock;
  busy: boolean;
}

export function ReadyPanel({
  active,
  busy,
  onStart,
  onEndBlock,
  onPlannedRest,
}: PanelProps & { onStart(): void; onEndBlock(): void; onPlannedRest(sec: number): void }) {
  return (
    <section>
      <h2>{active.exercise.name}</h2>
      <PlannedRestStepper
        value={active.block.plannedRestSec}
        busy={busy}
        onChange={onPlannedRest}
      />
      <Button type="button" className="button primary" disabled={busy} onClick={onStart}>
        {strings.workout.start}
      </Button>
      <Button type="button" className="button secondary" disabled={busy} onClick={onEndBlock}>
        {strings.workout.endBlock.ready}
      </Button>
    </section>
  );
}

export function SetRunningPanel({
  active,
  busy,
  setNumber,
  startedAt,
  onDone,
}: PanelProps & { setNumber: number; startedAt: number; onDone(): void }) {
  return (
    <section>
      <h2>{active.exercise.name}</h2>
      <h3>{strings.workout.setHeading(setNumber)}</h3>
      <SetTimer startedAt={startedAt} />
      <Button type="button" className="button primary" disabled={busy} onClick={onDone}>
        {strings.workout.done}
      </Button>
    </section>
  );
}

function RepsEntry({
  suggestion,
  busy,
  onSave,
}: {
  suggestion: number;
  busy: boolean;
  onSave(reps: number): void;
}) {
  const [reps, setReps] = useState(suggestion);
  return (
    <>
      <Stepper
        outputLabel={strings.workout.reps}
        display={String(reps)}
        lessLabel={strings.workout.repsLess}
        moreLabel={strings.workout.repsMore}
        lessDisabled={reps <= 0}
        moreDisabled={reps >= REPS_MAX}
        onLess={() => setReps(Math.max(0, reps - 1))}
        onMore={() => setReps(Math.min(REPS_MAX, reps + 1))}
      />
      <Button type="button" className="button primary" disabled={busy} onClick={() => onSave(reps)}>
        {strings.workout.save}
      </Button>
    </>
  );
}

export function RepsPanel({
  active,
  busy,
  setId,
  setNumber,
  suggestion,
  endedAt,
  onSave,
  onPlannedRest,
}: PanelProps & {
  setId: string;
  setNumber: number;
  suggestion: number;
  endedAt: number;
  onSave(reps: number): void;
  onPlannedRest(sec: number): void;
}) {
  return (
    <section>
      <h2>{active.exercise.name}</h2>
      <h3>{strings.workout.setHeading(setNumber)}</h3>
      <RepsEntry key={setId} suggestion={suggestion} busy={busy} onSave={onSave} />
      <RestTimer endedAt={endedAt} plannedRestSec={active.block.plannedRestSec} />
      <PlannedRestStepper
        value={active.block.plannedRestSec}
        busy={busy}
        onChange={onPlannedRest}
      />
    </section>
  );
}

export function RestPanel({
  active,
  busy,
  endedAt,
  onStart,
  onEndBlock,
  onPlannedRest,
}: PanelProps & {
  endedAt: number;
  onStart(): void;
  onEndBlock(): void;
  onPlannedRest(sec: number): void;
}) {
  const saved = active.sets.filter(isSetSaved);
  return (
    <section>
      <h2>{active.exercise.name}</h2>
      <RestTimer endedAt={endedAt} plannedRestSec={active.block.plannedRestSec} />
      <PlannedRestStepper
        value={active.block.plannedRestSec}
        busy={busy}
        onChange={onPlannedRest}
      />
      <ul className="set-lines">
        {saved.map((set, i) => (
          <li key={set.id}>{strings.workout.setLine(i + 1, set.reps ?? 0)}</li>
        ))}
      </ul>
      <Button type="button" className="button primary" disabled={busy} onClick={onStart}>
        {strings.workout.start}
      </Button>
      <Button type="button" className="button secondary" disabled={busy} onClick={onEndBlock}>
        {strings.workout.endBlock.resting}
      </Button>
    </section>
  );
}
