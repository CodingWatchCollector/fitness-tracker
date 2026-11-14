import type {
  Apparatus,
  Exercise,
  ExerciseType,
  LoadDirection,
  MovementPattern,
  Muscle,
  Phase,
} from './types';

export const SEED_REVISION = 1;

interface SeedRow {
  id: string;
  name: string;
  type: ExerciseType;
  unilateral: boolean;
  pattern: MovementPattern;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  defaultPhase: Phase;
  apparatus: Apparatus[];
  imageKey: string | null;
  defaultRestSec: number;
  defaultLoadDirection: LoadDirection;
  description: string;
}

// Ids are fixed forever: exports and future sync reference them. See seed-ids.test.ts.
const SEED_ROWS: SeedRow[] = [
  {
    id: '877ec463-3998-4ea3-87a5-abb0ae6332d7',
    name: 'Push-up',
    type: 'rep',
    unilateral: false,
    pattern: 'push',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front delts', 'triceps'],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: 'Pushups',
    defaultRestSec: 90,
    defaultLoadDirection: 'harder',
    description:
      'Hands under the shoulders, body in one straight line. Lower the chest to the floor and press back up.',
  },
  {
    id: '78067a12-eccb-4e83-a8b5-4e50b343b7a7',
    name: 'Pull-up',
    type: 'rep',
    unilateral: false,
    pattern: 'pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'middle back'],
    defaultPhase: 'main',
    apparatus: ['bar'],
    imageKey: 'Pullups',
    defaultRestSec: 120,
    defaultLoadDirection: 'harder',
    description:
      'Start from a dead hang with the shoulders set. Pull the chin over the bar and lower under control.',
  },
  {
    id: 'fc2aede7-3a47-4573-a479-e7a057635a47',
    name: 'Dips',
    type: 'rep',
    unilateral: false,
    pattern: 'push',
    primaryMuscles: ['triceps', 'chest'],
    secondaryMuscles: ['front delts'],
    defaultPhase: 'main',
    apparatus: ['dip station'],
    imageKey: 'Parallel_Bar_Dip',
    defaultRestSec: 120,
    defaultLoadDirection: 'harder',
    description:
      'Support yourself on straight arms and lean slightly forward. Lower until the upper arms are parallel to the floor, then press up.',
  },
  {
    id: '23b41154-8c8f-4cb7-97c1-f8a14f1f4619',
    name: 'Straight leg pull-up (L-sit pull-up)',
    type: 'rep',
    unilateral: false,
    pattern: 'pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'abs', 'hip flexors'],
    defaultPhase: 'main',
    apparatus: ['bar'],
    imageKey: null,
    defaultRestSec: 120,
    defaultLoadDirection: 'harder',
    description:
      'Hold the legs straight and level with the hips while you pull. Keep the legs up for the whole rep.',
  },
  {
    id: '5e0e66b0-247b-40b9-bd77-2c14d9e75dd2',
    name: 'Back lever',
    type: 'time',
    unilateral: false,
    pattern: 'skill',
    primaryMuscles: ['lats', 'lower back'],
    secondaryMuscles: ['biceps', 'rear delts', 'abs'],
    defaultPhase: 'main',
    apparatus: ['rings', 'bar'],
    imageKey: null,
    defaultRestSec: 120,
    defaultLoadDirection: 'easier',
    description:
      'Hang, rotate backwards until the body is horizontal and face-down. Keep the body straight and the arms locked.',
  },
  {
    id: '1092bec5-2af4-4974-9683-218bf4b36fec',
    name: 'Pike push-up',
    type: 'rep',
    unilateral: false,
    pattern: 'push',
    primaryMuscles: ['front delts'],
    secondaryMuscles: ['triceps', 'traps'],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: null,
    defaultRestSec: 90,
    defaultLoadDirection: 'harder',
    description:
      'Hips high in an inverted V. Lower the head toward the floor between the hands and press back up.',
  },
  {
    id: '0f1d2ea0-e8f8-45c3-a2d9-7433df94a837',
    name: 'Pike push-up (elbows out)',
    type: 'rep',
    unilateral: false,
    pattern: 'push',
    primaryMuscles: ['side delts'],
    secondaryMuscles: ['triceps', 'traps'],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: null,
    defaultRestSec: 90,
    defaultLoadDirection: 'harder',
    description:
      'Same inverted V, with the elbows flaring out to the sides. Lower the head between the hands and press up.',
  },
  {
    id: '68f39101-618f-4659-89e9-fa3163d9aca0',
    name: 'Calf raises',
    type: 'rep',
    unilateral: false,
    pattern: 'legs',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: null,
    defaultRestSec: 60,
    defaultLoadDirection: 'harder',
    description:
      'Rise onto the balls of the feet as high as possible. Pause at the top and lower slowly.',
  },
  {
    id: '92b8e7b4-a872-43f4-b600-359431363d69',
    name: 'Pistol squat',
    type: 'rep',
    unilateral: true,
    pattern: 'legs',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'calves', 'abs'],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: null,
    defaultRestSec: 90,
    defaultLoadDirection: 'easier',
    description:
      'Stand on one leg with the other leg extended forward. Squat down under control and stand back up without letting the heel lift.',
  },
  {
    id: '00e72375-c5cc-46b8-9158-6bf6cbfcf2a4',
    name: 'Ring rows',
    type: 'rep',
    unilateral: false,
    pattern: 'pull',
    primaryMuscles: ['middle back'],
    secondaryMuscles: ['lats', 'biceps', 'rear delts'],
    defaultPhase: 'main',
    apparatus: ['rings'],
    imageKey: 'Inverted_Row_with_Straps',
    defaultRestSec: 90,
    defaultLoadDirection: 'harder',
    description:
      'Body straight under the rings, heels on the floor. Pull the chest to the rings and lower slowly.',
  },
  {
    id: '1e6b628f-8849-432c-a063-ed6c30038773',
    name: 'L-sit compression',
    type: 'time',
    unilateral: false,
    pattern: 'skill',
    primaryMuscles: ['abs', 'hip flexors'],
    secondaryMuscles: ['quads'],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: null,
    defaultRestSec: 90,
    defaultLoadDirection: 'harder',
    description:
      'Sit with the legs straight and hands pressing into the floor. Lift the legs and pull them toward the torso.',
  },
  {
    id: '4dde6600-1ad9-4c92-9d6b-bc98673a3849',
    name: 'Squat',
    type: 'rep',
    unilateral: false,
    pattern: 'legs',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    defaultPhase: 'main',
    apparatus: ['floor'],
    imageKey: 'Bodyweight_Squat',
    defaultRestSec: 90,
    defaultLoadDirection: 'harder',
    description:
      'Feet shoulder-width apart, chest up. Sit down until the thighs are parallel to the floor and stand up.',
  },
  {
    id: '460566d2-66a1-41a1-ad18-ba7d04b1be99',
    name: 'RTO hold',
    type: 'time',
    unilateral: false,
    pattern: 'skill',
    primaryMuscles: ['triceps', 'chest', 'front delts'],
    secondaryMuscles: ['biceps', 'abs'],
    defaultPhase: 'warm-up',
    apparatus: ['rings'],
    imageKey: null,
    defaultRestSec: 60,
    defaultLoadDirection: 'harder',
    description:
      'Support on the rings with the arms straight, then turn the rings out. Keep the shoulders pushed down.',
  },
  {
    id: '6ac00890-dd69-43c4-aec1-771ed1d29104',
    name: 'Full body warm-up',
    type: 'time',
    unilateral: false,
    pattern: 'none',
    primaryMuscles: [],
    secondaryMuscles: [],
    defaultPhase: 'warm-up',
    apparatus: [],
    imageKey: null,
    defaultRestSec: 0,
    defaultLoadDirection: 'harder',
    description:
      'Easy mobility work for shoulders, hips and spine. Move through the full range without forcing it.',
  },
  {
    id: '59905cb2-e11f-40d3-9f54-15224ee9ab25',
    name: 'Face pull',
    type: 'rep',
    unilateral: false,
    pattern: 'pull',
    primaryMuscles: ['rear delts', 'traps'],
    secondaryMuscles: ['middle back'],
    defaultPhase: 'main',
    apparatus: ['rings'],
    imageKey: null,
    defaultRestSec: 60,
    defaultLoadDirection: 'harder',
    description:
      'Pull the rings toward the face with the elbows high and wide. Squeeze the shoulder blades together.',
  },
];

export const SEED_IDS: string[] = SEED_ROWS.map((r) => r.id);

export function buildSeedExercises(now: number): Exercise[] {
  return SEED_ROWS.map(({ imageKey, ...row }) => ({
    ...row,
    videoUrl: null,
    images: imageKey
      ? {
          start: { kind: 'bundled', key: `${imageKey}/0` },
          end: { kind: 'bundled', key: `${imageKey}/1` },
        }
      : { start: null, end: null },
    leadInSec: row.type === 'rep' ? 3 : 10,
    endOffsetSec: 0,
    favorite: false,
    custom: false,
    seedRevision: SEED_REVISION,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}
