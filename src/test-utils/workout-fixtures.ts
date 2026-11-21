import { act } from '@testing-library/react';
import { expect } from 'vitest';
import {
  openDataStore,
  type DataStore,
  type Exercise,
  type ExerciseBlock,
  type Workout,
  type WorkoutSet,
} from '../data';
import { rawStore } from './raw-idb';
import { settle } from './settle';
import { testClock, type TestClock } from './test-clock';

export const T = 1_700_000_000_000;
export const sec = (n: number) => T + n * 1000;
export const H3 = 10_800_000;
export const DAY = 86_400_000;

export interface Fixture {
  name: string;
  clock: TestClock;
  store: DataStore;
  id(exerciseName: string): string;
  exercise(exerciseName: string): Exercise;
  workouts: ReturnType<typeof rawStore<Workout>>;
  blocks: ReturnType<typeof rawStore<ExerciseBlock>>;
  sets: ReturnType<typeof rawStore<WorkoutSet>>;
  dump(): Promise<{ workouts: Workout[]; blocks: ExerciseBlock[]; sets: WorkoutSet[] }>;
  at(ms: number): DataStore['workouts'];
}

const open: DataStore[] = [];

export function closeFixtures() {
  for (const store of open.splice(0)) store.close();
}

export function openStoreOn(name: string, clock: TestClock): DataStore {
  const store = openDataStore({ name, now: clock.now });
  open.push(store);
  return store;
}

export async function setup(options: { name?: string; start?: number } = {}): Promise<Fixture> {
  const name = options.name ?? crypto.randomUUID();
  const clock = testClock(options.start ?? T);
  const store = openDataStore({ name, now: clock.now });
  open.push(store);
  await store.ensureSeeded();
  const byName = new Map((await store.exercises.list()).map((e) => [e.name, e]));
  const workouts = rawStore<Workout>(name, 'workouts');
  const blocks = rawStore<ExerciseBlock>(name, 'exerciseBlocks');
  const sets = rawStore<WorkoutSet>(name, 'sets');
  const byId = <R extends { id: string }>(list: R[]) =>
    [...list].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    name,
    clock,
    store,
    id: (n) => byName.get(n)!.id,
    exercise: (n) => byName.get(n)!,
    workouts,
    blocks,
    sets,
    async dump() {
      return {
        workouts: byId(await workouts.getAll()),
        blocks: byId(await blocks.getAll()),
        sets: byId(await sets.getAll()),
      };
    },
    at(ms) {
      clock.set(ms);
      return store.workouts;
    },
  };
}

/** Push-up block opened T+10s, Set 1 started T+20s, Done T+50s, Reps 12 saved T+55s: step resting. */
export async function baseResting(f: Fixture) {
  const start = await f.at(T).start();
  const pushUp = f.id('Push-up');
  const opened = await f.at(sec(10)).openBlock(pushUp);
  const blockId = opened.blocks[0]!.block.id;
  const running = await f.at(sec(20)).startSet(blockId);
  const setId = running.blocks[0]!.sets[0]!.id;
  await f.at(sec(50)).doneSet(setId);
  await f.at(sec(55)).saveReps(setId, 12);
  return { workoutId: start.workout.id, blockId, setId };
}

/** Run one more Set on the base block: Set 2 started T+130s, Done T+160s, saved T+165s. */
export async function secondSet(f: Fixture, blockId: string, stop: 'running' | 'done' | 'saved') {
  const running = await f.at(sec(130)).startSet(blockId);
  const setId = running.blocks[0]!.sets[1]!.id;
  if (stop === 'running') return setId;
  await f.at(sec(160)).doneSet(setId);
  if (stop === 'done') return setId;
  await f.at(sec(165)).saveReps(setId, 11);
  return setId;
}

export async function assertClosed(name: string, workoutId: string) {
  const workout = (await rawStore<Workout>(name, 'workouts').get(workoutId))!;
  const blocks = (await rawStore<ExerciseBlock>(name, 'exerciseBlocks').getAll()).filter(
    (b) => b.workoutId === workoutId && b.deletedAt === null,
  );
  const allSets = await rawStore<WorkoutSet>(name, 'sets').getAll();
  expect(workout.endedAt).not.toBeNull();
  for (const block of blocks) {
    expect(block.endedAt).not.toBeNull();
    expect(block.endedAt!).toBeLessThanOrEqual(workout.endedAt!);
    const sets = allSets
      .filter((s) => s.blockId === block.id && s.deletedAt === null)
      .sort((a, b) => a.order - b.order);
    sets.forEach((s, i) => {
      expect(s.reps).not.toBeNull();
      expect(s.endedAt).not.toBeNull();
      expect(s.restEndedAt).not.toBeNull();
      expect(s.endedAt!).toBeLessThanOrEqual(s.restEndedAt!);
      expect(s.restEndedAt!).toBeLessThanOrEqual(block.endedAt!);
      const next = sets[i + 1];
      if (next) expect(s.restEndedAt).toBe(next.startedAt);
    });
  }
}

export async function tick(f: Fixture, ms: number): Promise<void> {
  await settle();
  await act(() => {
    f.clock.set(ms);
    f.clock.tick();
  });
}
