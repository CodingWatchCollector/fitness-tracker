export const EXERCISE_TYPES = ['rep', 'time'] as const;
export const MOVEMENT_PATTERNS = ['push', 'pull', 'legs', 'core', 'skill', 'none'] as const;
export const PHASES = ['warm-up', 'main'] as const;
export const LOAD_DIRECTIONS = ['harder', 'easier'] as const;
export const APPARATUS = ['floor', 'bar', 'rings', 'dip station'] as const;
export const MUSCLE_GROUPS = [
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
] as const;
export const EXTRA_KINDS = ['negatives', 'partials', 'assisted reps', 'hold'] as const;
export const RIR_VALUES = [0, 1, 2, 3] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];
export type Phase = (typeof PHASES)[number];
export type LoadDirection = (typeof LOAD_DIRECTIONS)[number];
export type Apparatus = (typeof APPARATUS)[number];
export type Muscle = (typeof MUSCLE_GROUPS)[number];
export type ExtraKind = (typeof EXTRA_KINDS)[number];
export type Rir = (typeof RIR_VALUES)[number];

export interface RecordMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ImageRef {
  kind: 'bundled';
  key: string;
}

export interface Exercise extends RecordMeta {
  name: string;
  type: ExerciseType;
  unilateral: boolean;
  apparatus: Apparatus[];
  pattern: MovementPattern;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  description: string;
  videoUrl: string | null;
  images: { start: ImageRef | null; end: ImageRef | null };
  defaultPhase: Phase;
  defaultRestSec: number;
  leadInSec: number;
  endOffsetSec: number;
  defaultLoadDirection: LoadDirection;
  favorite: boolean;
  custom: boolean;
  seedRevision: number | null;
}

export interface EquipmentItem extends RecordMeta {
  name: string;
  nominalKg: number;
}

export interface Tag extends RecordMeta {
  label: string;
}

// Workout, ExerciseBlock and WorkoutSet are provisional until MVP-b to MVP-d add write paths.
export interface Workout extends RecordMeta {
  startedAt: number;
  endedAt: number | null;
  autoClosed: boolean;
  note: string;
}

export interface ExerciseBlock extends RecordMeta {
  workoutId: string;
  exerciseId: string;
  phase: Phase;
  order: number;
  followsBlockId: string | null;
  plannedRestSec: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface WorkoutSet extends RecordMeta {
  blockId: string;
  order: number;
  startedAt: number | null;
  leadInSec: number;
  endedAt: number | null;
  endOffsetSec: number;
  timeUnderLoadSec: number | null;
  reps: number | null;
  repsLeft: number | null;
  repsRight: number | null;
  durationSec: number | null;
  targetTimeSec: number | null;
  extras: { kind: ExtraKind; amount: number }[];
  rir: Rir | null;
  load: { kg: number | null; equipmentItemId: string | null; direction: LoadDirection } | null;
  tagIds: string[];
  note: string;
  plannedRestSec: number;
  restEndedAt: number | null;
}
