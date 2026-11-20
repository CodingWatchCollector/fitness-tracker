import {
  AUTO_CLOSE_AFTER_MS,
  PLANNED_REST_MAX_SEC,
  REPS_MAX,
  byOrder,
  deriveStep,
  guardIntent,
  isLive,
  isSetSaved,
  isStale,
  lastActivity,
  pickRepsSuggestion,
  planClose,
  type ClosePlan,
  type Intent,
  type WorkoutRecords,
  type WorkoutStep,
} from '../workout/machine';
import type { FitnessDb } from './db';
import type { Exercise, ExerciseBlock, Workout, WorkoutSet } from './types';

export type WorkoutStateErrorCode =
  | 'workout-already-active'
  | 'no-active-workout'
  | 'invalid-transition'
  | 'exercise-not-found'
  | 'exercise-not-rep-based'
  | 'invalid-value';

export class WorkoutStateError extends Error {
  readonly code: WorkoutStateErrorCode;
  constructor(code: WorkoutStateErrorCode) {
    super(code);
    this.name = 'WorkoutStateError';
    this.code = code;
  }
}

export interface ActiveBlock {
  block: ExerciseBlock;
  exercise: Exercise;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  workout: Workout;
  blocks: ActiveBlock[];
  step: WorkoutStep;
  autoCloseAt: number;
}

export const RECENT_LIMIT = 5;

export interface WorkoutsApi {
  current(): Promise<ActiveWorkout | null>;
  start(): Promise<ActiveWorkout>;
  openBlock(exerciseId: string): Promise<ActiveWorkout>;
  setPlannedRest(blockId: string, plannedRestSec: number): Promise<ActiveWorkout>;
  startSet(blockId: string): Promise<ActiveWorkout>;
  doneSet(setId: string): Promise<ActiveWorkout>;
  saveReps(setId: string, reps: number): Promise<ActiveWorkout>;
  endBlock(blockId: string): Promise<ActiveWorkout>;
  finish(): Promise<null>;
}

const latestFirst = (a: Workout, b: Workout) =>
  b.startedAt - a.startedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const isInt = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

export function createWorkouts(db: FitnessDb, ready: Promise<void>, now: () => number) {
  const stores = [db.workouts, db.exerciseBlocks, db.sets, db.exercises];

  async function openWorkouts(): Promise<Workout[]> {
    const all = await db.workouts.toArray();
    return all.filter((w) => isLive(w) && w.endedAt === null).sort(latestFirst);
  }

  async function setsOfBlock(blockId: string): Promise<WorkoutSet[]> {
    return db.sets
      .where('[blockId+order]')
      .between([blockId, -Infinity], [blockId, Infinity])
      .toArray();
  }

  async function loadRecords(workout: Workout): Promise<WorkoutRecords> {
    const blocks = await db.exerciseBlocks.where('workoutId').equals(workout.id).toArray();
    const sets = (await Promise.all(blocks.map((b) => setsOfBlock(b.id)))).flat();
    return { workout, blocks, sets };
  }

  async function applyPlan(plan: ClosePlan): Promise<void> {
    await db.workouts.update(plan.workout.id, plan.workout.changes);
    for (const b of plan.blocks) await db.exerciseBlocks.update(b.id, b.changes);
    for (const s of plan.sets) await db.sets.update(s.id, s.changes);
  }

  async function closeIfStale(): Promise<void> {
    await ready;
    await db.transaction('rw', db.workouts, db.exerciseBlocks, db.sets, async () => {
      const [active, ...others] = await openWorkouts();
      if (!active) return;
      const t = now();
      for (const w of others) await applyPlan(planClose(await loadRecords(w), 'auto', t));
      const records = await loadRecords(active);
      if (isStale(records, t)) await applyPlan(planClose(records, 'auto', t));
    });
  }

  async function lastWorkoutFirstSet(
    exerciseId: string,
    currentWorkoutId: string,
  ): Promise<WorkoutSet | undefined> {
    const rows = await db.exerciseBlocks
      .where('[exerciseId+startedAt]')
      .between([exerciseId, -Infinity], [exerciseId, Infinity])
      .reverse()
      .toArray();
    for (const row of rows) {
      if (!isLive(row) || row.workoutId === currentWorkoutId) continue;
      const workout = await db.workouts.get(row.workoutId);
      if (!workout || !isLive(workout)) continue;
      const sameExercise = (await db.exerciseBlocks.where('workoutId').equals(workout.id).toArray())
        .filter((b) => isLive(b) && b.exerciseId === exerciseId)
        .sort(byOrder);
      for (const b of sameExercise) {
        const first = (await setsOfBlock(b.id)).filter(isLive).filter(isSetSaved).sort(byOrder)[0];
        if (first) return first;
      }
    }
    return undefined;
  }

  async function snapshot(workout: Workout): Promise<ActiveWorkout> {
    const records = await loadRecords(workout);
    const derived = deriveStep(records);
    const autoCloseAt = lastActivity(records) + AUTO_CLOSE_AFTER_MS;
    const liveBlocks = records.blocks.filter(isLive).sort(byOrder);
    const blocks: ActiveBlock[] = [];
    for (const block of liveBlocks) {
      const exercise = await db.exercises.get(block.exerciseId);
      if (!exercise) throw new Error(`Exercise ${block.exerciseId} is missing`);
      blocks.push({
        block,
        exercise,
        sets: records.sets.filter((s) => s.blockId === block.id && isLive(s)).sort(byOrder),
      });
    }
    if (derived.kind !== 'reps-pending') return { workout, blocks, step: derived, autoCloseAt };
    const stepBlock = blocks.find((b) => b.block.id === derived.blockId)!;
    const first = await lastWorkoutFirstSet(stepBlock.block.exerciseId, workout.id);
    const repsSuggestion = pickRepsSuggestion(stepBlock.sets, derived.setId, first);
    return { workout, blocks, step: { ...derived, repsSuggestion }, autoCloseAt };
  }

  async function mutate(
    write: (ctx: {
      workout: Workout;
      records: WorkoutRecords;
      step: WorkoutStep;
      t: number;
    }) => Promise<void>,
  ): Promise<ActiveWorkout> {
    await closeIfStale();
    return db.transaction('rw', stores, async () => {
      const workout = (await openWorkouts())[0];
      if (!workout) throw new WorkoutStateError('no-active-workout');
      const records = await loadRecords(workout);
      const step = deriveStep(records);
      await write({ workout, records, step, t: now() });
      return snapshot((await db.workouts.get(workout.id))!);
    });
  }

  function guard(step: WorkoutStep, intent: Intent): void {
    const code = guardIntent(step, intent);
    if (code) throw new WorkoutStateError(code);
  }

  const blockOf = (records: WorkoutRecords, id: string) => records.blocks.find((b) => b.id === id)!;
  const setOf = (records: WorkoutRecords, id: string) => records.sets.find((s) => s.id === id)!;

  const workouts: WorkoutsApi = {
    async current() {
      await closeIfStale();
      return db.transaction('r', stores, async () => {
        const workout = (await openWorkouts())[0];
        return workout ? snapshot(workout) : null;
      });
    },

    async start() {
      await closeIfStale();
      return db.transaction('rw', stores, async () => {
        if ((await openWorkouts()).length > 0)
          throw new WorkoutStateError('workout-already-active');
        const t = now();
        const workout: Workout = {
          id: crypto.randomUUID(),
          createdAt: t,
          updatedAt: t,
          deletedAt: null,
          startedAt: t,
          endedAt: null,
          autoClosed: false,
          note: '',
        };
        await db.workouts.add(workout);
        return snapshot(workout);
      });
    },

    openBlock: (exerciseId) =>
      mutate(async ({ workout, records, step, t }) => {
        const exercise = await db.exercises.get(exerciseId);
        if (!exercise || !isLive(exercise)) throw new WorkoutStateError('exercise-not-found');
        if (exercise.type !== 'rep') throw new WorkoutStateError('exercise-not-rep-based');
        guard(step, { kind: 'openBlock' });
        const order = Math.max(0, ...records.blocks.map((b) => b.order)) + 1;
        await db.exerciseBlocks.add({
          id: crypto.randomUUID(),
          createdAt: t,
          updatedAt: t,
          deletedAt: null,
          workoutId: workout.id,
          exerciseId,
          phase: exercise.defaultPhase,
          order,
          followsBlockId: null,
          plannedRestSec: exercise.defaultRestSec,
          startedAt: null,
          endedAt: null,
        });
      }),

    setPlannedRest: (blockId, plannedRestSec) =>
      mutate(async ({ step, t }) => {
        if (!isInt(plannedRestSec, 0, PLANNED_REST_MAX_SEC)) {
          throw new WorkoutStateError('invalid-value');
        }
        guard(step, { kind: 'setPlannedRest', blockId });
        await db.exerciseBlocks.update(blockId, { plannedRestSec, updatedAt: t });
        if (step.kind === 'reps-pending' || step.kind === 'resting') {
          await db.sets.update(step.setId, { plannedRestSec, updatedAt: t });
        }
      }),

    startSet: (blockId) =>
      mutate(async ({ records, step, t }) => {
        guard(step, { kind: 'startSet', blockId });
        const block = blockOf(records, blockId);
        if (step.kind === 'resting') {
          await db.sets.update(step.setId, { restEndedAt: t, updatedAt: t });
        }
        if (block.startedAt === null) {
          await db.exerciseBlocks.update(blockId, { startedAt: t, updatedAt: t });
        }
        const order =
          Math.max(0, ...records.sets.filter((s) => s.blockId === blockId).map((s) => s.order)) + 1;
        await db.sets.add({
          id: crypto.randomUUID(),
          createdAt: t,
          updatedAt: t,
          deletedAt: null,
          blockId,
          order,
          startedAt: t,
          leadInSec: 0,
          endedAt: null,
          endOffsetSec: 0,
          timeUnderLoadSec: null,
          reps: null,
          repsLeft: null,
          repsRight: null,
          durationSec: null,
          targetTimeSec: null,
          extras: [],
          rir: null,
          load: null,
          tagIds: [],
          note: '',
          plannedRestSec: block.plannedRestSec,
          restEndedAt: null,
        });
      }),

    doneSet: (setId) =>
      mutate(async ({ records, step, t }) => {
        guard(step, { kind: 'doneSet', setId });
        const block = blockOf(records, setOf(records, setId).blockId);
        await db.sets.update(setId, {
          endedAt: t,
          plannedRestSec: block.plannedRestSec,
          updatedAt: t,
        });
      }),

    saveReps: (setId, reps) =>
      mutate(async ({ step, t }) => {
        if (!isInt(reps, 0, REPS_MAX)) throw new WorkoutStateError('invalid-value');
        guard(step, { kind: 'saveReps', setId });
        await db.sets.update(setId, { reps, updatedAt: t });
      }),

    endBlock: (blockId) =>
      mutate(async ({ records, step, t }) => {
        guard(step, { kind: 'endBlock', blockId });
        if (step.kind === 'resting') {
          await db.sets.update(step.setId, { restEndedAt: t, updatedAt: t });
          await db.exerciseBlocks.update(blockId, { endedAt: t, updatedAt: t });
          return;
        }
        const hasSaved = records.sets.some(
          (s) => s.blockId === blockId && isLive(s) && isSetSaved(s),
        );
        await db.exerciseBlocks.update(
          blockId,
          hasSaved ? { endedAt: t, updatedAt: t } : { deletedAt: t, updatedAt: t },
        );
      }),

    async finish() {
      await closeIfStale();
      await db.transaction('rw', stores, async () => {
        const workout = (await openWorkouts())[0];
        if (!workout) throw new WorkoutStateError('no-active-workout');
        await applyPlan(planClose(await loadRecords(workout), 'finish', now()));
      });
      return null;
    },
  };

  async function recent(limit: number = RECENT_LIMIT): Promise<Exercise[]> {
    await ready;
    return db.transaction('r', stores, async () => {
      const all = (await db.workouts.toArray()).filter(isLive).sort(latestFirst);
      const current = all.find((w) => w.endedAt === null);
      const excluded = new Set<string>();
      if (current) {
        const blocks = await db.exerciseBlocks.where('workoutId').equals(current.id).toArray();
        for (const b of blocks) if (isLive(b)) excluded.add(b.exerciseId);
      }
      const result: Exercise[] = [];
      for (const workout of all) {
        if (workout === current) continue;
        const blocks = (await db.exerciseBlocks.where('workoutId').equals(workout.id).toArray())
          .filter(isLive)
          .sort((a, b) => b.order - a.order);
        for (const block of blocks) {
          if (result.length >= limit) return result;
          if (excluded.has(block.exerciseId)) continue;
          const hasSaved = (await setsOfBlock(block.id)).some((s) => isLive(s) && isSetSaved(s));
          if (!hasSaved) continue;
          const exercise = await db.exercises.get(block.exerciseId);
          if (!exercise || !isLive(exercise)) continue;
          excluded.add(block.exerciseId);
          result.push(exercise);
        }
      }
      return result.slice(0, limit);
    });
  }

  return { workouts, recent };
}
