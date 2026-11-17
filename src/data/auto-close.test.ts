// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { Workout } from './index';
import {
  H3,
  T,
  assertClosed,
  baseResting,
  closeFixtures,
  sec,
  secondSet,
  setup,
} from '../test-utils/workout-fixtures';

afterEach(closeFixtures);

const STALE = sec(55) + H3;

describe('auto-close boundary', () => {
  it('keeps the Workout 1 ms before 3 h and closes it at 3 h', async () => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    const before = await f.dump();

    f.clock.set(STALE - 1);
    expect((await f.store.workouts.current())?.workout.id).toBe(workoutId);
    expect(await f.dump()).toEqual(before);

    f.clock.set(STALE);
    expect(await f.store.workouts.current()).toBeNull();
    const dump = await f.dump();
    expect(dump.workouts[0]).toMatchObject({
      endedAt: sec(50),
      autoClosed: true,
      updatedAt: STALE,
    });
    expect(dump.blocks.find((b) => b.id === blockId)!.endedAt).toBe(sec(50));
    expect(dump.sets.find((s) => s.id === setId)!.restEndedAt).toBe(sec(50));
    await assertClosed(f.name, workoutId);
  });
});

describe('auto-close end times', () => {
  it.each([
    ['running', sec(130) + H3],
    ['done', sec(160) + H3],
  ] as const)('discards a Set that is %s', async (stop, now) => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    const set2 = await secondSet(f, blockId, stop);
    f.clock.set(now);
    expect(await f.store.workouts.current()).toBeNull();
    const dump = await f.dump();
    expect(dump.sets.find((s) => s.id === set2)).toMatchObject({ deletedAt: now, updatedAt: now });
    expect(dump.sets.find((s) => s.id === setId)!.restEndedAt).toBe(sec(50));
    expect(dump.blocks[0]!.endedAt).toBe(sec(50));
    expect(dump.workouts[0]!.endedAt).toBe(sec(50));
    await assertClosed(f.name, workoutId);
  });

  it('uses the End block time when the block was ended', async () => {
    const f = await setup();
    const { workoutId, blockId } = await baseResting(f);
    await f.at(sec(200)).endBlock(blockId);
    f.clock.set(sec(200) + H3);
    expect(await f.store.workouts.current()).toBeNull();
    expect((await f.dump()).workouts[0]!.endedAt).toBe(sec(200));
    await assertClosed(f.name, workoutId);
  });

  it('soft-deletes an empty block and ends the Workout at its start', async () => {
    const f = await setup();
    const { workout } = await f.at(T).start();
    await f.at(sec(5)).openBlock(f.id('Dips'));
    f.clock.set(sec(5) + H3);
    expect(await f.store.workouts.current()).toBeNull();
    const dump = await f.dump();
    expect(dump.blocks[0]!.deletedAt).toBe(sec(5) + H3);
    expect(dump.workouts[0]!.endedAt).toBe(T);
    await assertClosed(f.name, workout.id);
  });

  it('counts a planned rest change as activity', async () => {
    const f = await setup();
    const { blockId } = await baseResting(f);
    await f.at(sec(1000)).setPlannedRest(blockId, 45);
    f.clock.set(STALE);
    expect(await f.store.workouts.current()).not.toBeNull();
    f.clock.set(sec(1000) + H3);
    expect(await f.store.workouts.current()).toBeNull();
  });

  it('counts a soft-deleted block as activity', async () => {
    const f = await setup();
    await f.at(T).start();
    const opened = await f.at(sec(5)).openBlock(f.id('Dips'));
    await f.at(sec(500)).endBlock(opened.blocks[0]!.block.id);
    f.clock.set(sec(5) + H3);
    expect(await f.store.workouts.current()).not.toBeNull();
  });

  it('closes from the fallback ready without touching the last saved Set', async () => {
    const f = await setup();
    const { workoutId, blockId, setId } = await baseResting(f);
    const set2 = await secondSet(f, blockId, 'saved');
    const stored = (await f.sets.get(set2))!;
    await f.sets.put({ ...stored, deletedAt: sec(170), updatedAt: sec(170) });
    f.clock.set(sec(170) + H3);
    expect(await f.store.workouts.current()).toBeNull();
    const dump = await f.dump();
    expect(dump.blocks[0]!.endedAt).toBe(sec(130));
    expect(dump.sets.find((s) => s.id === setId)).toMatchObject({
      endedAt: sec(50),
      restEndedAt: sec(130),
    });
    expect(dump.workouts[0]).toMatchObject({ endedAt: sec(130), autoClosed: true });
    await assertClosed(f.name, workoutId);
  });
});

describe('auto-close runs first in every Workout call', () => {
  it('commits the close even when startSet then rejects', async () => {
    const f = await setup();
    const { blockId, setId } = await baseResting(f);
    f.clock.set(STALE);
    await expect(f.store.workouts.startSet(blockId)).rejects.toMatchObject({
      code: 'no-active-workout',
    });
    const dump = await f.dump();
    expect(dump.workouts[0]).toMatchObject({ autoClosed: true });
    expect(dump.blocks[0]!.endedAt).toBe(sec(50));
    expect(dump.sets).toHaveLength(1);
    expect(dump.sets[0]!.id).toBe(setId);
  });

  type Mutation = [string, (f: Awaited<ReturnType<typeof setup>>, ids: Ids) => Promise<unknown>];
  type Ids = { blockId: string; setId: string };

  const cases: [string, 'picking' | 'resting' | 'set-running' | 'reps-pending', Mutation[1]][] = [
    ['openBlock from picking', 'picking', (f) => f.store.workouts.openBlock(f.id('Dips'))],
    [
      'setPlannedRest from resting',
      'resting',
      (f, i) => f.store.workouts.setPlannedRest(i.blockId, 30),
    ],
    ['endBlock from resting', 'resting', (f, i) => f.store.workouts.endBlock(i.blockId)],
    ['doneSet from set-running', 'set-running', (f, i) => f.store.workouts.doneSet(i.setId)],
    ['saveReps from reps-pending', 'reps-pending', (f, i) => f.store.workouts.saveReps(i.setId, 5)],
    ['finish from resting', 'resting', (f) => f.store.workouts.finish()],
  ];

  it.each(cases)('%s rejects with no-active-workout', async (_name, state, run) => {
    const f = await setup();
    let last = T;
    let ids: Ids = { blockId: '', setId: '' };
    if (state === 'picking') {
      await f.at(T).start();
    } else if (state === 'resting') {
      ids = await baseResting(f);
      last = sec(55);
    } else {
      await f.at(T).start();
      const opened = await f.at(sec(10)).openBlock(f.id('Push-up'));
      const blockId = opened.blocks[0]!.block.id;
      const running = await f.at(sec(20)).startSet(blockId);
      const setId = running.blocks[0]!.sets[0]!.id;
      last = sec(20);
      if (state === 'reps-pending') {
        await f.at(sec(50)).doneSet(setId);
        last = sec(50);
      }
      ids = { blockId, setId };
    }
    f.clock.set(last + H3);
    await expect(run(f, ids)).rejects.toMatchObject({ code: 'no-active-workout' });
    expect((await f.dump()).workouts[0]).toMatchObject({ autoClosed: true });
  });

  it('start() closes the old Workout and opens a new one', async () => {
    const f = await setup();
    const { workoutId } = await baseResting(f);
    f.clock.set(STALE);
    const next = await f.store.workouts.start();
    expect(next.workout.id).not.toBe(workoutId);
    const dump = await f.dump();
    expect(dump.workouts.find((w) => w.id === workoutId)).toMatchObject({ autoClosed: true });
  });

  it('recent() does not close anything and the stale Workout still counts as current', async () => {
    const f = await setup();
    await baseResting(f);
    f.clock.set(STALE);
    const before = await f.dump();
    expect(await f.store.exercises.recent()).toEqual([]);
    expect(await f.dump()).toEqual(before);
    expect(before.workouts[0]!.endedAt).toBeNull();
  });
});

describe('several open Workouts', () => {
  const open = (id: string, startedAt: number): Workout => ({
    id,
    createdAt: startedAt,
    updatedAt: startedAt,
    deletedAt: null,
    startedAt,
    endedAt: null,
    autoClosed: false,
    note: '',
  });

  it('keeps the latest started and auto-closes the other', async () => {
    const f = await setup();
    await f.workouts.put(open('00000000-0000-4000-8000-0000000000aa', T));
    await f.workouts.put(open('00000000-0000-4000-8000-0000000000bb', sec(10)));
    f.clock.set(sec(20));
    expect((await f.store.workouts.current())?.workout.id).toBe(
      '00000000-0000-4000-8000-0000000000bb',
    );
    const old = (await f.workouts.get('00000000-0000-4000-8000-0000000000aa'))!;
    expect(old).toMatchObject({ endedAt: T, autoClosed: true });
  });

  it('breaks a startedAt tie by the greater id', async () => {
    const f = await setup();
    const one = '00000000-0000-4000-8000-000000000001';
    const two = '00000000-0000-4000-8000-000000000002';
    await f.workouts.put(open(one, T));
    await f.workouts.put(open(two, T));
    f.clock.set(sec(20));
    expect((await f.store.workouts.current())?.workout.id).toBe(two);
    expect((await f.workouts.get(one))!.autoClosed).toBe(true);
  });
});
