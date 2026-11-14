import Dexie, { type Table } from 'dexie';
import type { EquipmentItem, Exercise, ExerciseBlock, Tag, Workout, WorkoutSet } from './types';

/*
 * Record rules (also in README.md):
 * - Every write goes through the data module, which sets updatedAt = now() from the injected
 *   clock; callers never set meta fields.
 * - A soft delete sets deletedAt = updatedAt = now(). Cascades (Workout to blocks to Sets) are
 *   explicit and give children the same timestamp.
 * - Reads return only deletedAt === null records unless a function says otherwise.
 * - Records are never hard-deleted, except by import-restore (MVP-g). Seed Exercises never are.
 * - Seed Exercises carry seedRevision 1. Custom and user-edited seed Exercises have
 *   seedRevision null, which detaches them from the catalog. A future SEED_REVISION bump patches
 *   only records with custom === false && seedRevision !== null && seedRevision < SEED_REVISION,
 *   overwrites catalog fields only, keeps id, createdAt, favorite and deletedAt, and sets
 *   updatedAt = now(). MVP-a implements insert-if-absent only.
 * - Never edit a shipped version(n). Index or store changes go in a new version(n+1).
 */
export class FitnessDb extends Dexie {
  exercises!: Table<Exercise, string>;
  equipmentItems!: Table<EquipmentItem, string>;
  tags!: Table<Tag, string>;
  workouts!: Table<Workout, string>;
  exerciseBlocks!: Table<ExerciseBlock, string>;
  sets!: Table<WorkoutSet, string>;

  constructor(name: string) {
    super(name, { autoOpen: false });
    this.version(1).stores({
      exercises: 'id, name, updatedAt',
      equipmentItems: 'id, name, updatedAt',
      tags: 'id, label, updatedAt',
      workouts: 'id, startedAt, updatedAt',
      exerciseBlocks: 'id, workoutId, [workoutId+order], [exerciseId+startedAt], updatedAt',
      sets: 'id, [blockId+order], updatedAt, *tagIds',
    });
  }
}

export interface OpenedDb {
  db: FitnessDb;
  ready: Promise<void>;
  onVersionChange(cb: () => void): () => void;
}

export function openDb(name: string): OpenedDb {
  const db = new FitnessDb(name);
  const subscribers = new Set<() => void>();

  // Returning false keeps Dexie's default handler from closing the database a second time.
  db.on('versionchange', () => {
    db.close();
    for (const cb of [...subscribers]) cb();
    return false;
  });

  const ready = db.open().then(() => undefined);
  // The failure surfaces through store methods; this only prevents an unhandled rejection report.
  ready.catch(() => undefined);

  return {
    db,
    ready,
    onVersionChange(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}
