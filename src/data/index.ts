import { openDb } from './db';
import { SEED_IDS, buildSeedExercises } from './seed';
import type { Exercise } from './types';

export * from './types';

export interface DataStore {
  ensureSeeded(): Promise<void>;
  exercises: {
    list(): Promise<Exercise[]>;
    get(id: string): Promise<Exercise | undefined>;
  };
  onVersionChange(cb: () => void): () => void;
  close(): void;
}

export function bundledImageUrl(key: string): string {
  return `${import.meta.env.BASE_URL}exercise-images/${key}.jpg`;
}

export function openDataStore(options: { name?: string; now?: () => number } = {}): DataStore {
  const { name = 'fitness-tracker', now = Date.now } = options;
  const { db, ready, onVersionChange } = openDb(name);

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
    },
    onVersionChange,
    close() {
      db.close();
    },
  };
}
