// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { openDataStore, type Exercise } from './index';
import { rawExercises } from '../test-utils/raw-idb';

const T = 1_700_000_000_000;
const ORDER_WITHOUT_SQUAT = [
  'Back lever',
  'Calf raises',
  'Dips',
  'Face pull',
  'Full body warm-up',
  'L-sit compression',
  'Pike push-up',
  'Pike push-up (elbows out)',
  'Pistol squat',
  'Pull-up',
  'Push-up',
  'Ring rows',
  'RTO hold',
  'Straight leg pull-up (L-sit pull-up)',
];

describe('exercise reads', () => {
  it('lists live Exercises in case-insensitive name order and gets by id', async () => {
    const name = crypto.randomUUID();
    const store = openDataStore({ name, now: () => T });
    await store.ensureSeeded();
    const seeded = await store.exercises.list();
    const squat = seeded.find((e) => e.name === 'Squat')!;
    const pushUp = seeded.find((e) => e.name === 'Push-up')!;

    await rawExercises.put(name, {
      ...pushUp,
      id: crypto.randomUUID(),
      name: 'a test',
    } satisfies Exercise);
    await rawExercises.put(name, { ...squat, deletedAt: T, updatedAt: T });

    const list = await store.exercises.list();
    expect(list.map((e) => e.name)).toEqual(['a test', ...ORDER_WITHOUT_SQUAT]);
    expect(await store.exercises.get(squat.id)).toBeUndefined();
    expect(await store.exercises.get('missing')).toBeUndefined();
    expect((await store.exercises.get(pushUp.id))?.name).toBe('Push-up');
    store.close();
  });

  it('reads an unseeded store as empty', async () => {
    const store = openDataStore({ name: crypto.randomUUID() });
    expect(await store.exercises.list()).toEqual([]);
    expect(await store.exercises.get('877ec463-3998-4ea3-87a5-abb0ae6332d7')).toBeUndefined();
    store.close();
  });
});
