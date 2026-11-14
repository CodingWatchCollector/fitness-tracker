// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  APPARATUS,
  EXERCISE_TYPES,
  EXTRA_KINDS,
  LOAD_DIRECTIONS,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  PHASES,
  RIR_VALUES,
  openDataStore,
} from './index';

interface StoreShape {
  keyPath: unknown;
  autoIncrement: boolean;
  indexes: Record<string, { keyPath: unknown; multiEntry: boolean }>;
}

function inspectDb(name: string): Promise<{ version: number; stores: Record<string, StoreShape> }> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const stores: Record<string, StoreShape> = {};
      const names = Array.from(db.objectStoreNames);
      const tx = db.transaction(names, 'readonly');
      for (const n of names) {
        const os = tx.objectStore(n);
        const indexes: StoreShape['indexes'] = {};
        for (const i of Array.from(os.indexNames)) {
          const ix = os.index(i);
          indexes[i] = { keyPath: ix.keyPath, multiEntry: ix.multiEntry };
        }
        stores[n] = { keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes };
      }
      const version = db.version;
      db.close();
      resolve({ version, stores });
    };
  });
}

const plain = { multiEntry: false };

describe('schema', () => {
  it('creates IndexedDB version 10 with the expected stores and indexes', async () => {
    const name = crypto.randomUUID();
    const store = openDataStore({ name });
    await store.ensureSeeded();
    store.close();
    const { version, stores } = await inspectDb(name);

    expect(version).toBe(10);
    expect(Object.keys(stores).sort()).toEqual(
      ['equipmentItems', 'exerciseBlocks', 'exercises', 'sets', 'tags', 'workouts'].sort(),
    );
    for (const s of Object.values(stores)) {
      expect(s.keyPath).toBe('id');
      expect(s.autoIncrement).toBe(false);
    }
    expect(stores.exercises!.indexes).toEqual({
      name: { keyPath: 'name', ...plain },
      updatedAt: { keyPath: 'updatedAt', ...plain },
    });
    expect(stores.equipmentItems!.indexes).toEqual({
      name: { keyPath: 'name', ...plain },
      updatedAt: { keyPath: 'updatedAt', ...plain },
    });
    expect(stores.tags!.indexes).toEqual({
      label: { keyPath: 'label', ...plain },
      updatedAt: { keyPath: 'updatedAt', ...plain },
    });
    expect(stores.workouts!.indexes).toEqual({
      startedAt: { keyPath: 'startedAt', ...plain },
      updatedAt: { keyPath: 'updatedAt', ...plain },
    });
    expect(stores.exerciseBlocks!.indexes).toEqual({
      'workoutId': { keyPath: 'workoutId', ...plain },
      '[workoutId+order]': { keyPath: ['workoutId', 'order'], ...plain },
      '[exerciseId+startedAt]': { keyPath: ['exerciseId', 'startedAt'], ...plain },
      'updatedAt': { keyPath: 'updatedAt', ...plain },
    });
    expect(stores.sets!.indexes).toEqual({
      '[blockId+order]': { keyPath: ['blockId', 'order'], ...plain },
      'updatedAt': { keyPath: 'updatedAt', ...plain },
      'tagIds': { keyPath: 'tagIds', multiEntry: true },
    });
  });

  it('opens the database fitness-tracker by default', async () => {
    const store = openDataStore();
    await store.ensureSeeded();
    const names = (await indexedDB.databases()).map((d) => d.name);
    store.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('fitness-tracker');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    expect(names).toContain('fitness-tracker');
  });

  it('exports the enumerations', () => {
    expect(EXERCISE_TYPES).toEqual(['rep', 'time']);
    expect(MOVEMENT_PATTERNS).toEqual(['push', 'pull', 'legs', 'core', 'skill', 'none']);
    expect(PHASES).toEqual(['warm-up', 'main']);
    expect(LOAD_DIRECTIONS).toEqual(['harder', 'easier']);
    expect(APPARATUS).toEqual(['floor', 'bar', 'rings', 'dip station']);
    expect(MUSCLE_GROUPS).toEqual([
      'abs',
      'abductors',
      'adductors',
      'biceps',
      'calves',
      'chest',
      'forearms',
      'glutes',
      'hamstrings',
      'hip flexors',
      'lats',
      'lower back',
      'middle back',
      'neck',
      'quads',
      'front delts',
      'side delts',
      'rear delts',
      'traps',
      'triceps',
    ]);
    expect(MUSCLE_GROUPS).toHaveLength(20);
    expect(EXTRA_KINDS).toEqual(['negatives', 'partials', 'assisted reps', 'hold']);
    expect(RIR_VALUES).toEqual([0, 1, 2, 3]);
  });
});
