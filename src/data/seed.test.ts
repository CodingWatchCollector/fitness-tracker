// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, bundledImageUrl, openDataStore, type Exercise } from './index';
import { rawExercises } from '../test-utils/raw-idb';

const T = 1_700_000_000_000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Expected {
  type: 'rep' | 'time';
  unilateral: boolean;
  pattern: string;
  primary: string[];
  secondary: string[];
  phase: string;
  apparatus: string[];
  images: string | null;
  rest: number;
  load: string;
}

const E = (
  type: 'rep' | 'time',
  unilateral: boolean,
  pattern: string,
  primary: string[],
  secondary: string[],
  phase: string,
  apparatus: string[],
  images: string | null,
  rest: number,
  load: string,
): Expected => ({
  type,
  unilateral,
  pattern,
  primary,
  secondary,
  phase,
  apparatus,
  images,
  rest,
  load,
});

const TABLE: Record<string, Expected> = {
  'Push-up': E(
    'rep',
    false,
    'push',
    ['chest'],
    ['front delts', 'triceps'],
    'main',
    ['floor'],
    'Pushups',
    90,
    'harder',
  ),
  'Pull-up': E(
    'rep',
    false,
    'pull',
    ['lats'],
    ['biceps', 'middle back'],
    'main',
    ['bar'],
    'Pullups',
    120,
    'harder',
  ),
  'Dips': E(
    'rep',
    false,
    'push',
    ['triceps', 'chest'],
    ['front delts'],
    'main',
    ['dip station'],
    'Parallel_Bar_Dip',
    120,
    'harder',
  ),
  'Straight leg pull-up (L-sit pull-up)': E(
    'rep',
    false,
    'pull',
    ['lats'],
    ['biceps', 'abs', 'hip flexors'],
    'main',
    ['bar'],
    null,
    120,
    'harder',
  ),
  'Back lever': E(
    'time',
    false,
    'skill',
    ['lats', 'lower back'],
    ['biceps', 'rear delts', 'abs'],
    'main',
    ['rings', 'bar'],
    null,
    120,
    'easier',
  ),
  'Pike push-up': E(
    'rep',
    false,
    'push',
    ['front delts'],
    ['triceps', 'traps'],
    'main',
    ['floor'],
    null,
    90,
    'harder',
  ),
  'Pike push-up (elbows out)': E(
    'rep',
    false,
    'push',
    ['side delts'],
    ['triceps', 'traps'],
    'main',
    ['floor'],
    null,
    90,
    'harder',
  ),
  'Calf raises': E('rep', false, 'legs', ['calves'], [], 'main', ['floor'], null, 60, 'harder'),
  'Pistol squat': E(
    'rep',
    true,
    'legs',
    ['quads', 'glutes'],
    ['hamstrings', 'calves', 'abs'],
    'main',
    ['floor'],
    null,
    90,
    'easier',
  ),
  'Ring rows': E(
    'rep',
    false,
    'pull',
    ['middle back'],
    ['lats', 'biceps', 'rear delts'],
    'main',
    ['rings'],
    'Inverted_Row_with_Straps',
    90,
    'harder',
  ),
  'L-sit compression': E(
    'time',
    false,
    'skill',
    ['abs', 'hip flexors'],
    ['quads'],
    'main',
    ['floor'],
    null,
    90,
    'harder',
  ),
  'Squat': E(
    'rep',
    false,
    'legs',
    ['quads'],
    ['glutes', 'hamstrings'],
    'main',
    ['floor'],
    'Bodyweight_Squat',
    90,
    'harder',
  ),
  'RTO hold': E(
    'time',
    false,
    'skill',
    ['triceps', 'chest', 'front delts'],
    ['biceps', 'abs'],
    'warm-up',
    ['rings'],
    null,
    60,
    'harder',
  ),
  'Full body warm-up': E('time', false, 'none', [], [], 'warm-up', [], null, 0, 'harder'),
  'Face pull': E(
    'rep',
    false,
    'pull',
    ['rear delts', 'traps'],
    ['middle back'],
    'main',
    ['rings'],
    null,
    60,
    'harder',
  ),
};

async function seededStore(name = crypto.randomUUID()) {
  const store = openDataStore({ name, now: () => T });
  await store.ensureSeeded();
  return { store, name };
}

describe('seed content', () => {
  it('seeds the 15 catalog Exercises', async () => {
    const { store } = await seededStore();
    const list = await store.exercises.list();
    expect(list).toHaveLength(15);
    expect(list.map((e) => e.name).sort()).toEqual(Object.keys(TABLE).sort());

    for (const ex of list) {
      const want = TABLE[ex.name]!;
      expect(ex.type).toBe(want.type);
      expect(ex.unilateral).toBe(want.unilateral);
      expect(ex.pattern).toBe(want.pattern);
      expect(ex.primaryMuscles).toEqual(want.primary);
      expect(ex.secondaryMuscles).toEqual(want.secondary);
      expect(ex.defaultPhase).toBe(want.phase);
      expect(ex.apparatus).toEqual(want.apparatus);
      expect(ex.images).toEqual(
        want.images
          ? {
              start: { kind: 'bundled', key: `${want.images}/0` },
              end: { kind: 'bundled', key: `${want.images}/1` },
            }
          : { start: null, end: null },
      );
      expect(ex.defaultRestSec).toBe(want.rest);
      expect(ex.defaultLoadDirection).toBe(want.load);

      expect(ex.id).toMatch(UUID_V4);
      expect(ex.createdAt).toBe(T);
      expect(ex.updatedAt).toBe(T);
      expect(ex.deletedAt).toBeNull();
      expect(ex.custom).toBe(false);
      expect(ex.favorite).toBe(false);
      expect(ex.videoUrl).toBeNull();
      expect(ex.seedRevision).toBe(1);
      expect(ex.endOffsetSec).toBe(0);
      expect(ex.leadInSec).toBe(want.type === 'rep' ? 3 : 10);
      expect(ex.description.length).toBeGreaterThan(0);
      for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) {
        expect(MUSCLE_GROUPS).toContain(m);
      }
    }
    store.close();
  });

  it('resolves a bundled image key to its URL', () => {
    expect(bundledImageUrl('Pushups/0')).toBe('/exercise-images/Pushups/0.jpg');
  });
});

describe('seed idempotence', () => {
  it('never overwrites an existing seed record', async () => {
    const { store, name } = await seededStore();
    const pushUp = (await store.exercises.list()).find((e) => e.name === 'Push-up')!;
    const edited: Exercise = { ...pushUp, name: 'Edited', updatedAt: T + 1000 };
    await rawExercises.put(name, edited);

    await store.ensureSeeded();

    const all = await rawExercises.getAll(name);
    expect(all).toHaveLength(15);
    expect(all.find((e) => e.id === pushUp.id)).toEqual(edited);
    store.close();
  });

  it('inserts a removed seed record again', async () => {
    const { store, name } = await seededStore();
    const squat = (await store.exercises.list()).find((e) => e.name === 'Squat')!;
    await rawExercises.delete(name, squat.id);
    expect(await rawExercises.getAll(name)).toHaveLength(14);

    await store.ensureSeeded();

    expect(await rawExercises.get(name, squat.id)).toEqual(squat);
    store.close();
  });
});
