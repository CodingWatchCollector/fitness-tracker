import { openDb } from './db';
import { SEED_IDS, buildSeedExercises } from './seed';
import { createEquipment, type EquipmentApi } from './equipment';
import { createWorkouts, type WorkoutsApi } from './workouts';
import type { Exercise } from './types';

export * from './types';
export {
  AUTO_CLOSE_AFTER_MS,
  DEFAULT_REPS,
  PLANNED_REST_MAX_SEC,
  REPS_MAX,
  isSetSaved,
  type WorkoutStep,
} from '../workout/machine';
export {
  EQUIPMENT_NAME_MAX,
  LOAD_KG_MAX,
  LOAD_KG_MIN,
  isValidEquipmentInput,
  isValidKg,
  labelKey,
  normalizeLabel,
  type EquipmentApi,
  type EquipmentItemInput,
} from './equipment';
export {
  RECENT_LIMIT,
  WorkoutStateError,
  type ActiveBlock,
  type ActiveWorkout,
  type WorkoutStateErrorCode,
  type WorkoutsApi,
} from './workouts';

export interface DataStore {
  ensureSeeded(): Promise<void>;
  exercises: {
    list(): Promise<Exercise[]>;
    get(id: string): Promise<Exercise | undefined>;
    recent(limit?: number): Promise<Exercise[]>;
  };
  workouts: WorkoutsApi;
  equipment: EquipmentApi;
  onVersionChange(cb: () => void): () => void;
  close(): void;
}

export function bundledImageUrl(key: string): string {
  return `${import.meta.env.BASE_URL}exercise-images/${key}.jpg`;
}

export function openDataStore(options: { name?: string; now?: () => number } = {}): DataStore {
  const { name = 'fitness-tracker', now = Date.now } = options;
  const { db, ready, onVersionChange } = openDb(name);
  const { workouts, recent } = createWorkouts(db, ready, now);

  return {
    async ensureSeeded() {
      await ready;
      await db.transaction('rw', db.exercises, async () => {
        const existing = await db.exercises.bulkGet(SEED_IDS);
        const timestamp = now();
        const missing = buildSeedExercises(timestamp).filter((_, i) => existing[i] === undefined);
        if (missing.length > 0) await db.exercises.bulkAdd(missing);
      });
    },
    exercises: {
      async list() {
        await ready;
        const all = await db.exercises.toArray();
        return all
          .filter((e) => e.deletedAt === null)
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      },
      async get(id) {
        await ready;
        const found = await db.exercises.get(id);
        return found && found.deletedAt === null ? found : undefined;
      },
      recent,
    },
    workouts,
    equipment: createEquipment(db, ready, now),
    onVersionChange,
    close() {
      db.close();
    },
  };
}
