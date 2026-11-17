import type {
  Apparatus,
  ExerciseType,
  LoadDirection,
  MovementPattern,
  Muscle,
  Phase,
} from './data';

const labels = {
  exerciseType: { rep: 'Reps', time: 'Time' } satisfies Record<ExerciseType, string>,
  pattern: {
    push: 'Push',
    pull: 'Pull',
    legs: 'Legs',
    core: 'Core',
    skill: 'Skill',
    none: 'General',
  } satisfies Record<MovementPattern, string>,
  phase: { 'warm-up': 'Warm-up', 'main': 'Main' } satisfies Record<Phase, string>,
  loadDirection: {
    harder: 'More load is harder',
    easier: 'More load is easier',
  } satisfies Record<LoadDirection, string>,
  apparatus: {
    'floor': 'Floor',
    'bar': 'Bar',
    'rings': 'Rings',
    'dip station': 'Dip station',
  } satisfies Record<Apparatus, string>,
  muscle: {
    'abs': 'Abs',
    'abductors': 'Abductors',
    'adductors': 'Adductors',
    'biceps': 'Biceps',
    'calves': 'Calves',
    'chest': 'Chest',
    'forearms': 'Forearms',
    'glutes': 'Glutes',
    'hamstrings': 'Hamstrings',
    'hip flexors': 'Hip flexors',
    'lats': 'Lats',
    'lower back': 'Lower back',
    'middle back': 'Middle back',
    'neck': 'Neck',
    'quads': 'Quads',
    'front delts': 'Front delts',
    'side delts': 'Side delts',
    'rear delts': 'Rear delts',
    'traps': 'Traps',
    'triceps': 'Triceps',
  } satisfies Record<Muscle, string>,
};

const pad = (n: number) => String(n).padStart(2, '0');

export const strings = {
  appName: 'Fitness Tracker',
  clock: (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  },
  home: {
    startWorkout: 'Start Workout',
    resumeWorkout: 'Resume Workout',
    inProgress: 'A Workout is in progress.',
    exercises: 'Exercises',
    startFailed: 'Could not start the Workout. Try again.',
  },
  picker: {
    search: 'Search exercises',
    favorites: 'Favorites',
    recent: 'Recent',
    all: 'All exercises',
    noMatches: 'No exercises match.',
    timeBasedLater: 'Timed sets come in a later update.',
  },
  stepper: { decrease: '-', increase: '+' },
  workout: {
    overallTimer: 'Workout time',
    setTimer: 'Set in progress',
    restTimer: 'Rest time',
    restPhase: { countdown: 'Rest', overtime: 'Overtime' },
    overtime: (clock: string) => `+${clock}`,
    plannedRest: 'Planned rest',
    restLess: 'Less rest',
    restMore: 'More rest',
    reps: 'Reps',
    repsLess: 'Fewer reps',
    repsMore: 'More reps',
    setHeading: (n: number) => `Set ${n}`,
    setLine: (n: number, reps: number) =>
      reps === 1 ? `Set ${n}: 1 rep` : `Set ${n}: ${reps} reps`,
    start: 'Start',
    done: 'Done',
    save: 'Save',
    endBlock: { ready: 'Pick another Exercise', resting: 'End block' },
    finish: 'Finish Workout',
    finishDialog: {
      title: 'Finish this Workout?',
      unsaved: 'The current Set is not saved and will be discarded.',
      confirm: 'Finish',
      cancel: 'Keep going',
    },
    actionFailed: 'That did not work. Try again.',
  },
  back: 'Back to exercises',
  none: 'None',
  seconds: (n: number) => `${n} s`,
  status: {
    loading: 'Loading...',
    error: 'Something went wrong. Reload the page to try again.',
    reloadNeeded: 'The app was updated in another tab. Reload to continue.',
    reload: 'Reload',
  },
  exerciseList: {
    title: 'Exercises',
    meta: (typeLabel: string, patternLabel: string) => `${typeLabel} \u00b7 ${patternLabel}`,
  },
  exerciseDetail: {
    notFound: 'Exercise not found.',
    unilateral: 'Trained one side at a time.',
    video: 'Watch video',
    fields: {
      type: 'Type',
      apparatus: 'Apparatus',
      pattern: 'Pattern',
      primary: 'Primary muscles',
      secondary: 'Secondary muscles',
      phase: 'Phase',
      rest: 'Rest',
      leadIn: 'Lead-in',
      endOffset: 'End offset',
      loadDirection: 'Load direction',
    },
    imageAlt: {
      start: (name: string) => `${name} start position`,
      end: (name: string) => `${name} end position`,
    },
    noPhoto: (name: string) => `${name} (no photo)`,
  },
  labels,
};
