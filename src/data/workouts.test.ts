// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { WorkoutStateError, openDataStore, type ExerciseBlock } from './index';
import { rawExercises } from '../test-utils/raw-idb';
import {
  DAY,
  H3,
  T,
  assertClosed,
  baseResting,
  closeFixtures,
  sec,
  secondSet,
  setup,
  type Fixture,
} from '../test-utils/workout-fixtures';

afterEach(closeFixtures);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function rejectsWith(promise: Promise<unknown>, code: string) {
  const error = await promise.then(() => null).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(WorkoutStateError);
  expect((error as WorkoutStateError).code).toBe(code);
}

describe('start and the single active Workout', () => {
  it('starts a Workout, rejects a second start and allows a new one after finish', async () => {
    const f = await setup();
    const started = await f.at(T).start();
    expect(started).toEqual({
      workout: {
        id: expect.stringMatching(UUID_V4),
        startedAt: T,
        endedAt: null,
        autoClosed: false,
        note: '',
        createdAt: T,
        updatedAt: T,
        deletedAt: null,
      },
      blocks: [],
      step: { kind: 'picking' },
      autoCloseAt: T + H3,
    });
    expect(await f.store.workouts.current()).toEqual(started);

    await rejectsWith(f.at(sec(5)).start(), 'workout-already-active');
    expect((await f.dump()).workouts).toHaveLength(1);

    expect(await f.at(sec(10)).finish()).toBeNull();
    const second = await f.at(sec(20)).start();
    expect(second.workout.startedAt).toBe(sec(20));
    expect((await f.store.workouts.current())?.workout.id).toBe(second.workout.id);
  });
});

describe('the Set loop', () => {
  it('writes the documented records and returns the stored state after every call', async () => {
    const f = await setup();
    const w = f.store.workouts;
    const current = async () => w.current();
    await f.at(T).start();

    const opened = await f.at(sec(10)).openBlock(f.id('Push-up'));
    expect(opened).toEqual(await current());
    const block = opened.blocks[0]!.block;
    expect(block).toEqual({
      id: expect.stringMatching(UUID_V4),
      createdAt: sec(10),
      updatedAt: sec(10),
      deletedAt: null,
      workoutId: opened.workout.id,
      exerciseId: f.id('Push-up'),
      phase: 'main',
      order: 1,
      followsBlockId: null,
      plannedRestSec: 90,
      startedAt: null,
      endedAt: null,
    });
    expect(opened.step).toEqual({ kind: 'ready', blockId: block.id });

    const rest60 = await f.at(sec(15)).setPlannedRest(block.id, 60);
    expect(rest60).toEqual(await current());

    const running = await f.at(sec(20)).startSet(block.id);
    expect(running).toEqual(await current());
    const set1 = running.blocks[0]!.sets[0]!;
    expect(running.blocks[0]!.block).toMatchObject({ plannedRestSec: 60, startedAt: sec(20) });
    expect(set1).toEqual({
      id: expect.stringMatching(UUID_V4),
      createdAt: sec(20),
      updatedAt: sec(20),
      deletedAt: null,
      blockId: block.id,
      order: 1,
      startedAt: sec(20),
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
      plannedRestSec: 60,
      restEndedAt: null,
    });
    expect(running.step).toEqual({
      kind: 'set-running',
      blockId: block.id,
      setId: set1.id,
      startedAt: sec(20),
    });

    const done = await f.at(sec(50)).doneSet(set1.id);
    expect(done).toEqual(await current());
    expect(done.blocks[0]!.sets[0]).toMatchObject({ endedAt: sec(50), plannedRestSec: 60 });
    expect(done.step).toEqual({
      kind: 'reps-pending',
      blockId: block.id,
      setId: set1.id,
      endedAt: sec(50),
      plannedRestSec: 60,
      repsSuggestion: 10,
    });

    const rest75 = await f.at(sec(52)).setPlannedRest(block.id, 75);
    expect(rest75).toEqual(await current());
    expect(rest75.blocks[0]!.block.plannedRestSec).toBe(75);
    expect(rest75.blocks[0]!.sets[0]!.plannedRestSec).toBe(75);

    const saved = await f.at(sec(55)).saveReps(set1.id, 12);
    expect(saved).toEqual(await current());
    expect(saved.step).toEqual({
      kind: 'resting',
      blockId: block.id,
      setId: set1.id,
      endedAt: sec(50),
      plannedRestSec: 75,
    });

    const rest90 = await f.at(sec(60)).setPlannedRest(block.id, 90);
    expect(rest90).toEqual(await current());
    expect(rest90.blocks[0]!.block.plannedRestSec).toBe(90);
    expect(rest90.blocks[0]!.sets[0]!.plannedRestSec).toBe(90);

    const second = await f.at(sec(130)).startSet(block.id);
    expect(second).toEqual(await current());
    expect(second.blocks[0]!.sets[0]!.restEndedAt).toBe(sec(130));
    expect(second.blocks[0]!.sets[1]).toMatchObject({
      order: 2,
      startedAt: sec(130),
      plannedRestSec: 90,
    });
    const set2 = second.blocks[0]!.sets[1]!;

    const done2 = await f.at(sec(160)).doneSet(set2.id);
    expect(done2).toEqual(await current());
    expect(done2.step).toMatchObject({ kind: 'reps-pending', repsSuggestion: 12 });

    expect(await f.at(sec(165)).saveReps(set2.id, 11)).toEqual(await current());
    const ended = await f.at(sec(200)).endBlock(block.id);
    expect(ended).toEqual(await current());
    expect(ended.step).toEqual({ kind: 'picking' });

    const dump = await f.dump();
    expect(dump.blocks[0]).toMatchObject({ endedAt: sec(200), updatedAt: sec(200) });
    const byId = new Map(dump.sets.map((s) => [s.id, s]));
    expect(byId.get(set1.id)).toMatchObject({ restEndedAt: sec(130), updatedAt: sec(130) });
    expect(byId.get(set2.id)).toMatchObject({ restEndedAt: sec(200), updatedAt: sec(200) });
    expect(dump.workouts[0]!.updatedAt).toBe(T);
  });

  it('counts soft-deleted blocks and Sets when numbering', async () => {
    const f = await setup();
    await f.at(T).start();
    const dips = await f.at(sec(10)).openBlock(f.id('Dips'));
    await f.at(sec(20)).endBlock(dips.blocks[0]!.block.id);
    const reopened = await f.at(sec(30)).openBlock(f.id('Push-up'));
    expect(reopened.blocks[0]!.block.order).toBe(2);
  });

  it('numbers a new Set after a soft-deleted Set', async () => {
    const f = await setup();
    const { blockId, setId } = await baseResting(f);
    const stored = (await f.sets.get(setId))!;
    await f.sets.put({
      ...stored,
      id: crypto.randomUUID(),
      order: 2,
      deletedAt: sec(60),
      updatedAt: sec(60),
    });
    f.clock.set(sec(70));
    const next = await f.store.workouts.startSet(blockId);
    expect(next.blocks[0]!.sets.at(-1)!.order).toBe(3);
  });
});

describe('rejected calls', () => {
  type Call = (f: Fixture, ids: { blockId?: string; setId?: string }) => Promise<unknown>;
  const rows: [string, 'ready' | 'set-running' | 'reps-pending', Call, string][] = [
    [
      'doneSet in ready',
      'ready',
      (f, i) => f.store.workouts.doneSet(i.setId ?? 'x'),
      'invalid-transition',
    ],
    [
      'startSet in set-running',
      'set-running',
      (f, i) => f.store.workouts.startSet(i.blockId!),
      'invalid-transition',
    ],
    [
      'startSet in reps-pending',
      'reps-pending',
      (f, i) => f.store.workouts.startSet(i.blockId!),
      'invalid-transition',
    ],
    [
      'saveReps in set-running',
      'set-running',
      (f, i) => f.store.workouts.saveReps(i.setId!, 5),
      'invalid-transition',
    ],
    [
      'doneSet with another id in set-running',
      'set-running',
      (f) => f.store.workouts.doneSet('other'),
      'invalid-transition',
    ],
    [
      'endBlock in set-running',
      'set-running',
      (f, i) => f.store.workouts.endBlock(i.blockId!),
      'invalid-transition',
    ],
    [
      'openBlock in ready',
      'ready',
      (f) => f.store.workouts.openBlock(f.id('Dips')),
      'invalid-transition',
    ],
    [
      'openBlock of a time-based Exercise',
      'ready',
      (f) => f.store.workouts.openBlock(f.id('Back lever')),
      'exercise-not-rep-based',
    ],
    [
      'openBlock of a missing Exercise',
      'ready',
      (f) => f.store.workouts.openBlock('missing'),
      'exercise-not-found',
    ],
    [
      'saveReps -1',
      'reps-pending',
      (f, i) => f.store.workouts.saveReps(i.setId!, -1),
      'invalid-value',
    ],
    [
      'saveReps 1.5',
      'reps-pending',
      (f, i) => f.store.workouts.saveReps(i.setId!, 1.5),
      'invalid-value',
    ],
    [
      'saveReps 1000',
      'reps-pending',
      (f, i) => f.store.workouts.saveReps(i.setId!, 1000),
      'invalid-value',
    ],
    [
      'setPlannedRest -15',
      'ready',
      (f, i) => f.store.workouts.setPlannedRest(i.blockId!, -15),
      'invalid-value',
    ],
    [
      'setPlannedRest 3601',
      'ready',
      (f, i) => f.store.workouts.setPlannedRest(i.blockId!, 3601),
      'invalid-value',
    ],
    [
      'setPlannedRest 2.5',
      'ready',
      (f, i) => f.store.workouts.setPlannedRest(i.blockId!, 2.5),
      'invalid-value',
    ],
    [
      'setPlannedRest on a missing block',
      'ready',
      (f) => f.store.workouts.setPlannedRest('missing', 60),
      'invalid-transition',
    ],
    [
      'saveReps(missing, -1) in ready',
      'ready',
      (f) => f.store.workouts.saveReps('missing', -1),
      'invalid-value',
    ],
    [
      'setPlannedRest(missing, -15)',
      'ready',
      (f) => f.store.workouts.setPlannedRest('missing', -15),
      'invalid-value',
    ],
    [
      'openBlock(missing) in ready',
      'ready',
      (f) => f.store.workouts.openBlock('missing'),
      'exercise-not-found',
    ],
    [
      'openBlock(Back lever) in ready',
      'ready',
      (f) => f.store.workouts.openBlock(f.id('Back lever')),
      'exercise-not-rep-based',
    ],
  ];

  it.each(rows)('%s writes nothing', async (_name, state, call, code) => {
    const f = await setup();
    await f.at(T).start();
    const opened = await f.at(sec(10)).openBlock(f.id('Push-up'));
    const blockId = opened.blocks[0]!.block.id;
    let setId: string | undefined;
    if (state !== 'ready') {
      const running = await f.at(sec(20)).startSet(blockId);
      setId = running.blocks[0]!.sets[0]!.id;
    }
    if (state === 'reps-pending') await f.at(sec(50)).doneSet(setId!);
    const before = await f.dump();
    f.clock.set(sec(60));
    await rejectsWith(call(f, { blockId, setId }), code);
    expect(await f.dump()).toEqual(before);
  });

  it('rejects calls without an active Workout', async () => {
    const f = await setup();
    await rejectsWith(f.store.workouts.startSet('b'), 'no-active-workout');
    await rejectsWith(f.store.workouts.finish(), 'no-active-workout');
    await rejectsWith(f.store.workouts.openBlock(f.id('Dips')), 'no-active-workout');
    await rejectsWith(f.store.workouts.saveReps('missing', -1), 'no-active-workout');
    expect(await f.store.workouts.current()).toBeNull();
  });
});

describe('End block, Finish and the close rule', () => {
  it('soft-deletes an empty block on End block', async () => {
    const f = await setup();
    await f.at(T).start();
    const opened = await f.at(sec(10)).openBlock(f.id('Dips'));
    const ended = await f.at(sec(30)).endBlock(opened.blocks[0]!.block.id);
    expect(ended.blocks).toEqual([]);
    expect(ended.step).toEqual({ kind: 'picking' });
    expect((await f.dump()).blocks[0]).toMatchObject({ deletedAt: sec(30), updatedAt: sec(30) });
  });

  async function finishAt(f: Fixture, at: number, workoutId: string) {
    expect(await f.at(at).finish()).toBeNull();
    expect(await f.store.workouts.current()).toBeNull();
    await assertClosed(f.name, workoutId);
  }

  it('(a) finishes a fresh Workout without touching other records', async () => {
    const f = await setup();
    const { workout } = await f.at(T).start();
    await finishAt(f, sec(300), workout.id);
    const dump = await f.dump();
    expect(dump.workouts[0]).toMatchObject({
      endedAt: sec(300),
      autoClosed: false,
      updatedAt: sec(300),
    });
    expect(dump.blocks).toEqual([]);
  });

  it('(b) soft-deletes an empty open block', async () => {
    const f = await setup();
    const { workout } = await f.at(T).start();
    await f.at(sec(10)).openBlock(f.id('Dips'));
    await finishAt(f, sec(300), workout.id);
    const dump = await f.dump();
    expect(dump.blocks[0]).toMatchObject({ deletedAt: sec(300), updatedAt: sec(300) });
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(300), autoClosed: false });
  });

  it('(c) ends the rest and the block while resting', async () => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    await finishAt(f, sec(300), workoutId);
    const dump = await f.dump();
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(300), autoClosed: false });
    expect(dump.blocks.find((b) => b.id === blockId)).toMatchObject({ endedAt: sec(300) });
    expect(dump.sets.find((s) => s.id === setId)).toMatchObject({ restEndedAt: sec(300) });
  });

  it.each(['running', 'done'] as const)('(d,e) discards a Set that is %s', async (stop) => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    const set2 = await secondSet(f, blockId, stop);
    await finishAt(f, sec(300), workoutId);
    const dump = await f.dump();
    expect(dump.sets.find((s) => s.id === set2)).toMatchObject({
      deletedAt: sec(300),
      updatedAt: sec(300),
    });
    expect(dump.sets.find((s) => s.id === setId)!.restEndedAt).toBe(sec(300));
    expect(dump.blocks[0]!.endedAt).toBe(sec(300));
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(300), autoClosed: false });
  });

  it('(f) soft-deletes the block when its only Set was never saved', async () => {
    const f = await setup();
    const { workout } = await f.at(T).start();
    const opened = await f.at(sec(10)).openBlock(f.id('Push-up'));
    const blockId = opened.blocks[0]!.block.id;
    const running = await f.at(sec(20)).startSet(blockId);
    await f.at(sec(50)).doneSet(running.blocks[0]!.sets[0]!.id);
    await finishAt(f, sec(300), workout.id);
    const dump = await f.dump();
    expect(dump.sets[0]).toMatchObject({ deletedAt: sec(300) });
    expect(dump.blocks[0]).toMatchObject({ deletedAt: sec(300) });
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(300), autoClosed: false });
  });

  it('(g) never ends before a stored time when the clock moved back', async () => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    await finishAt(f, sec(40), workoutId);
    const dump = await f.dump();
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(50), autoClosed: false });
    expect(dump.blocks.find((b) => b.id === blockId)!.endedAt).toBe(sec(50));
    expect(dump.sets.find((s) => s.id === setId)!.restEndedAt).toBe(sec(50));
  });

  it('(g2) ignores the discarded Set when the clock moved back', async () => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    const set2 = await secondSet(f, blockId, 'running');
    await finishAt(f, sec(40), workoutId);
    const dump = await f.dump();
    expect(dump.sets.find((s) => s.id === set2)).toMatchObject({ deletedAt: sec(40) });
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(50), autoClosed: false });
    expect(dump.blocks[0]!.endedAt).toBe(sec(50));
    expect(dump.sets.find((s) => s.id === setId)!.restEndedAt).toBe(sec(50));
  });
});

describe('fallback ready (store level)', () => {
  async function fallback() {
    const f = await setup();
    const { blockId, setId } = await baseResting(f);
    const set2 = await secondSet(f, blockId, 'saved');
    const stored = (await f.sets.get(set2))!;
    await f.sets.put({ ...stored, deletedAt: sec(170), updatedAt: sec(170) });
    return { f, blockId, setId };
  }

  it('ends the block and keeps the saved Set on End block', async () => {
    const { f, blockId, setId } = await fallback();
    const before = (await f.sets.get(setId))!;
    const ended = await f.at(sec(300)).endBlock(blockId);
    expect(ended.step).toEqual({ kind: 'picking' });
    const dump = await f.dump();
    expect(dump.blocks[0]).toMatchObject({ endedAt: sec(300), deletedAt: null });
    expect(dump.sets.find((s) => s.id === setId)).toEqual(before);
  });

  it('soft-deletes the block on End block in a plain ready', async () => {
    const f = await setup();
    await f.at(T).start();
    const opened = await f.at(sec(10)).openBlock(f.id('Dips'));
    await f.at(sec(300)).endBlock(opened.blocks[0]!.block.id);
    expect((await f.dump()).blocks[0]!.deletedAt).toBe(sec(300));
  });
});

describe('recent Exercises and the Reps suggestion', () => {
  async function history(f: Fixture) {
    const w = f.store.workouts;
    const block = async (at: number, exercise: string, reps: number[]) => {
      f.clock.set(at);
      const opened = await w.openBlock(f.id(exercise));
      const blockId = opened.blocks.at(-1)!.block.id;
      let t = at;
      for (const r of reps) {
        t += 1000;
        const running = await f.at(t).startSet(blockId);
        const setId = running.blocks.at(-1)!.sets.at(-1)!.id;
        t += 1000;
        await f.at(t).doneSet(setId);
        t += 1000;
        await f.at(t).saveReps(setId, r);
      }
      f.clock.set(t + 1000);
      await w.endBlock(blockId);
      return t + 2000;
    };
    await f.at(T).start();
    let t = await block(T + 1000, 'Push-up', [10, 8]);
    t = await block(t, 'Dips', [6]);
    await f.at(t).finish();

    t = T + DAY;
    await f.at(t).start();
    t = await block(t + 1000, 'Pull-up', [5]);
    t = await block(t, 'Push-up', [12, 9]);
    f.clock.set(t);
    const squat = await w.openBlock(f.id('Squat'));
    await f.at(t + 1000).endBlock(squat.blocks.at(-1)!.block.id);
    await f.at(t + 2000).finish();

    await f.at(T + 2 * DAY).start();
    return T + 2 * DAY;
  }

  const names = async (f: Fixture, limit?: number) =>
    (await f.store.exercises.recent(limit)).map((e) => e.name);

  it('lists earlier-Workout Exercises and excludes the ones in the current Workout', async () => {
    const f = await setup();
    const w3 = await history(f);
    expect(await names(f)).toEqual(['Push-up', 'Pull-up', 'Dips']);
    expect(await names(f, 2)).toEqual(['Push-up', 'Pull-up']);

    const t = w3;
    const opened = await f.at(t + 1000).openBlock(f.id('Push-up'));
    const blockId = opened.blocks[0]!.block.id;
    expect(await names(f)).toEqual(['Pull-up', 'Dips']);

    let running = await f.at(t + 2000).startSet(blockId);
    let setId = running.blocks[0]!.sets[0]!.id;
    const done = await f.at(t + 3000).doneSet(setId);
    expect(done.step).toMatchObject({ kind: 'reps-pending', repsSuggestion: 12 });

    await f.at(t + 4000).saveReps(setId, 7);
    running = await f.at(t + 5000).startSet(blockId);
    setId = running.blocks[0]!.sets[1]!.id;
    const done2 = await f.at(t + 6000).doneSet(setId);
    expect(done2.step).toMatchObject({ repsSuggestion: 7 });
    await f.at(t + 7000).saveReps(setId, 6);
    await f.at(t + 8000).endBlock(blockId);
    expect(await names(f)).toEqual(['Pull-up', 'Dips']);

    const second = await f.at(t + 9000).openBlock(f.id('Push-up'));
    const secondId = second.blocks.at(-1)!.block.id;
    const run2 = await f.at(t + 10_000).startSet(secondId);
    const set2Id = run2.blocks.at(-1)!.sets[0]!.id;
    const done3 = await f.at(t + 11_000).doneSet(set2Id);
    expect(done3.step).toMatchObject({ repsSuggestion: 12 });
    await f.at(t + 12_000).saveReps(set2Id, 3);
    await f.at(t + 13_000).endBlock(secondId);

    const dips = await f.at(t + 14_000).openBlock(f.id('Dips'));
    expect(await names(f)).toEqual(['Pull-up']);
    await f.at(t + 15_000).endBlock(dips.blocks.at(-1)!.block.id);
    expect(await names(f)).toEqual(['Pull-up', 'Dips']);

    const squat = await f.at(t + 16_000).openBlock(f.id('Squat'));
    const squatId = squat.blocks.at(-1)!.block.id;
    const runSquat = await f.at(t + 17_000).startSet(squatId);
    const squatSet = runSquat.blocks.at(-1)!.sets[0]!.id;
    const doneSquat = await f.at(t + 18_000).doneSet(squatSet);
    expect(doneSquat.step).toMatchObject({ repsSuggestion: 10 });
    expect(await names(f)).toEqual(['Pull-up', 'Dips']);
    await f.at(t + 19_000).saveReps(squatSet, 20);
    expect(await names(f)).toEqual(['Pull-up', 'Dips']);
  });

  it('skips soft-deleted Exercises', async () => {
    const f = await setup();
    await history(f);
    const dips = f.exercise('Dips');
    await rawExercises.put(f.name, { ...dips, deletedAt: T, updatedAt: T });
    expect(await names(f)).toEqual(['Push-up', 'Pull-up']);
  });

  it('works without an open Workout and ignores blocks without a saved Set', async () => {
    const f = await setup();
    const w3 = await history(f);
    await f.at(w3 + 1000).finish();
    expect(await names(f)).toEqual(['Push-up', 'Pull-up', 'Dips']);

    const ring = f.exercise('Ring rows');
    const workout = (await f.workouts.getAll())[0]!;
    const rawWorkoutId = crypto.randomUUID();
    await f.workouts.put({
      ...workout,
      id: rawWorkoutId,
      startedAt: T + DAY + DAY / 2,
      endedAt: T + DAY + DAY / 2 + 1000,
      createdAt: T + DAY + DAY / 2,
      updatedAt: T + DAY + DAY / 2,
    });
    const block: ExerciseBlock = {
      id: crypto.randomUUID(),
      createdAt: T,
      updatedAt: T,
      deletedAt: null,
      workoutId: rawWorkoutId,
      exerciseId: ring.id,
      phase: 'main',
      order: 1,
      followsBlockId: null,
      plannedRestSec: 90,
      startedAt: T + DAY + DAY / 2,
      endedAt: T + DAY + DAY / 2 + 500,
    };
    await f.blocks.put(block);
    expect(await names(f)).toEqual(['Push-up', 'Pull-up', 'Dips']);
  });
});

describe('resume from storage (data level)', () => {
  it('a second store on the same database sees the first store state', async () => {
    const f = await setup();
    const { workoutId, blockId } = await baseResting(f);
    const last = await f.store.workouts.current();
    f.store.close();

    const other = openDataStore({ name: f.name, now: () => sec(80) });
    try {
      expect(await other.workouts.current()).toEqual(last);
      expect(last?.workout.id).toBe(workoutId);
      expect(last?.blocks[0]?.block.id).toBe(blockId);
    } finally {
      other.close();
    }
  });
});

describe('autoCloseAt', () => {
  it('is the start time plus 3 h on a fresh Workout and equals current()', async () => {
    const f = await setup();
    const started = await f.at(T).start();
    expect(started.autoCloseAt).toBe(T + H3);
    expect(started).toEqual(await f.at(T).current());
  });

  it('follows the latest write of the base Workout', async () => {
    const f = await setup();
    await baseResting(f);
    expect((await f.at(sec(60)).current())?.autoCloseAt).toBe(sec(55) + H3);
  });

  it('is still open 1 ms before it and closed at it', async () => {
    const f = await setup();
    await baseResting(f);
    expect((await f.at(sec(55) + H3 - 1).current())?.autoCloseAt).toBe(sec(55) + H3);
    expect(await f.at(sec(55) + H3).current()).toBeNull();
  });

  it('moves with a planned rest change', async () => {
    const f = await setup();
    const { blockId } = await baseResting(f);
    const changed = await f.at(sec(1000)).setPlannedRest(blockId, 75);
    expect(changed.autoCloseAt).toBe(sec(1000) + H3);
    expect(changed).toEqual(await f.at(sec(1000)).current());
  });

  it('counts a soft-deleted block as activity', async () => {
    const f = await setup();
    await f.at(T).start();
    const opened = await f.at(sec(5)).openBlock(f.id('Dips'));
    await f.at(sec(500)).endBlock(opened.blocks[0]!.block.id);
    expect((await f.at(sec(600)).current())?.autoCloseAt).toBe(sec(500) + H3);
  });
});
