// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ExerciseBlock, Workout, WorkoutSet } from '../data/types';
import {
  AUTO_CLOSE_AFTER_MS,
  deriveStep,
  elapsedSec,
  guardIntent,
  isStale,
  lastActivity,
  pickRepsSuggestion,
  planClose,
  restView,
  type Intent,
  type WorkoutRecords,
  type WorkoutStep,
} from './machine';

const T = 1_700_000_000_000;
const s = (n: number) => T + n * 1000;
const H3 = 10_800_000;

const workout: Workout = {
  id: 'w',
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
  startedAt: T,
  endedAt: null,
  autoClosed: false,
  note: '',
};

function block(id: string, order: number, over: Partial<ExerciseBlock> = {}): ExerciseBlock {
  return {
    id,
    createdAt: s(10),
    updatedAt: s(10),
    deletedAt: null,
    workoutId: 'w',
    exerciseId: 'e',
    phase: 'main',
    order,
    followsBlockId: null,
    plannedRestSec: 90,
    startedAt: null,
    endedAt: null,
    ...over,
  };
}

function set(
  id: string,
  blockId: string,
  order: number,
  over: Partial<WorkoutSet> = {},
): WorkoutSet {
  return {
    id,
    createdAt: s(20),
    updatedAt: s(20),
    deletedAt: null,
    blockId,
    order,
    startedAt: s(20),
    leadInSec: 0,
    endedAt: null,
    endOffsetSec: 0,
    timeUnderLoadSec: null,
    reps: null,
    repsLeft: null,
    repsRight: null,
    durationSec: null,
    targetTimeSec: null,
    extras: [],
    rir: null,
    load: null,
    tagIds: [],
    note: '',
    plannedRestSec: 90,
    restEndedAt: null,
    ...over,
  };
}

const rec = (blocks: ExerciseBlock[], sets: WorkoutSet[]): WorkoutRecords => ({
  workout,
  blocks,
  sets,
});

const open = block('b1', 1, { startedAt: s(20) });
const saved1 = set('s1', 'b1', 1, { endedAt: s(50), reps: 12 });
const deletedSet = (id: string, order: number, blockId = 'b1') =>
  set(id, blockId, order, { deletedAt: s(60) });
const deletedBlock = block('b9', 9, { deletedAt: s(60) });

describe('deriveStep', () => {
  const cases: [string, WorkoutRecords, WorkoutStep['kind']][] = [
    ['no open block', rec([], []), 'picking'],
    ['open block without Sets', rec([block('b1', 1)], []), 'ready'],
    ['running Set', rec([open], [set('s1', 'b1', 1)]), 'set-running'],
    ['Done without Reps', rec([open], [set('s1', 'b1', 1, { endedAt: s(50) })]), 'reps-pending'],
    ['saved Set, rest running', rec([open], [saved1]), 'resting'],
    [
      'saved Set with restEndedAt (fallback)',
      rec([open], [{ ...saved1, restEndedAt: s(130) }]),
      'ready',
    ],
  ];

  it.each(cases)('%s', (_name, records, kind) => {
    expect(deriveStep(records).kind).toBe(kind);
  });

  it.each(cases)('%s ignores soft-deleted records after it', (_name, records, kind) => {
    const withDeleted: WorkoutRecords = {
      ...records,
      blocks: [...records.blocks, deletedBlock],
      sets: [...records.sets, deletedSet('sx', 5), deletedSet('sy', 1, 'b9')],
    };
    expect(deriveStep(withDeleted).kind).toBe(kind);
  });

  it('lets the block with the higher order drive the step', () => {
    const records = rec([open, block('b2', 2)], [set('s1', 'b1', 1)]);
    expect(deriveStep(records)).toEqual({ kind: 'ready', blockId: 'b2' });
  });

  it('carries the stored data on the step', () => {
    expect(deriveStep(rec([open], [set('s1', 'b1', 1)]))).toEqual({
      kind: 'set-running',
      blockId: 'b1',
      setId: 's1',
      startedAt: s(20),
    });
    expect(deriveStep(rec([open], [saved1]))).toEqual({
      kind: 'resting',
      blockId: 'b1',
      setId: 's1',
      endedAt: s(50),
      plannedRestSec: 90,
    });
  });
});

describe('guardIntent', () => {
  const steps: WorkoutStep[] = [
    { kind: 'picking' },
    { kind: 'ready', blockId: 'b' },
    { kind: 'set-running', blockId: 'b', setId: 's', startedAt: 0 },
    {
      kind: 'reps-pending',
      blockId: 'b',
      setId: 's',
      endedAt: 0,
      plannedRestSec: 90,
      repsSuggestion: 10,
    },
    { kind: 'resting', blockId: 'b', setId: 's', endedAt: 0, plannedRestSec: 90 },
  ];
  const intents: Intent[] = [
    { kind: 'openBlock' },
    { kind: 'setPlannedRest', blockId: 'b' },
    { kind: 'startSet', blockId: 'b' },
    { kind: 'doneSet', setId: 's' },
    { kind: 'saveReps', setId: 's' },
    { kind: 'endBlock', blockId: 'b' },
  ];
  const allowed: Record<WorkoutStep['kind'], Intent['kind'][]> = {
    'picking': ['openBlock'],
    'ready': ['setPlannedRest', 'startSet', 'endBlock'],
    'set-running': ['setPlannedRest', 'doneSet'],
    'reps-pending': ['setPlannedRest', 'saveReps'],
    'resting': ['setPlannedRest', 'startSet', 'endBlock'],
  };

  for (const step of steps) {
    for (const intent of intents) {
      const expected = allowed[step.kind].includes(intent.kind) ? null : 'invalid-transition';
      it(`${step.kind} + ${intent.kind} -> ${expected}`, () => {
        expect(guardIntent(step, intent)).toBe(expected);
      });
    }
  }

  it('rejects ids that do not match the step', () => {
    expect(guardIntent(steps[1]!, { kind: 'startSet', blockId: 'other' })).toBe(
      'invalid-transition',
    );
    expect(guardIntent(steps[2]!, { kind: 'doneSet', setId: 'other' })).toBe('invalid-transition');
    expect(guardIntent(steps[3]!, { kind: 'setPlannedRest', blockId: 'other' })).toBe(
      'invalid-transition',
    );
  });
});

describe('planClose', () => {
  const base = rec([open], [{ ...saved1, endedAt: s(50), reps: 12, updatedAt: s(55) }]);
  const set2Running = set('s2', 'b1', 2, { startedAt: s(130), updatedAt: s(130) });
  const withSet2 = rec(
    [open],
    [{ ...saved1, restEndedAt: s(130), updatedAt: s(130) }, set2Running],
  );

  it('finish with a running Set discards it and closes the block at the close time', () => {
    const plan = planClose(withSet2, 'finish', s(300));
    expect(plan).toEqual({
      workout: { id: 'w', changes: { endedAt: s(300), autoClosed: false, updatedAt: s(300) } },
      blocks: [{ id: 'b1', changes: { endedAt: s(300), updatedAt: s(300) } }],
      sets: [
        { id: 's2', changes: { deletedAt: s(300), updatedAt: s(300) } },
        { id: 's1', changes: { restEndedAt: s(300), updatedAt: s(300) } },
      ],
    });
  });

  it('auto-close with a running Set ends everything at the last saved Set', () => {
    const plan = planClose(withSet2, 'auto', s(130) + H3);
    const now = s(130) + H3;
    expect(plan.workout.changes).toEqual({ endedAt: s(50), autoClosed: true, updatedAt: now });
    expect(plan.blocks).toEqual([{ id: 'b1', changes: { endedAt: s(50), updatedAt: now } }]);
    expect(plan.sets).toEqual([
      { id: 's2', changes: { deletedAt: now, updatedAt: now } },
      { id: 's1', changes: { restEndedAt: s(50), updatedAt: now } },
    ]);
  });

  it('auto-close from the fallback ready patches only the block and the Workout', () => {
    const fallback = rec(
      [open],
      [
        { ...saved1, restEndedAt: s(130) },
        set('s2', 'b1', 2, { startedAt: s(130), endedAt: s(160), reps: 11, deletedAt: s(170) }),
      ],
    );
    const now = s(170) + H3;
    const plan = planClose(fallback, 'auto', now);
    expect(plan.sets).toEqual([]);
    expect(plan.blocks).toEqual([{ id: 'b1', changes: { endedAt: s(130), updatedAt: now } }]);
    expect(plan.workout.changes).toEqual({ endedAt: s(130), autoClosed: true, updatedAt: now });
  });

  it('a clock that went backwards cannot end the Workout before a stored time', () => {
    const plan = planClose(base, 'finish', s(40));
    expect(plan.workout.changes.endedAt).toBe(s(50));
    expect(plan.blocks[0]!.changes.endedAt).toBe(s(50));
  });

  it('soft-deletes an open block without a saved Set', () => {
    const plan = planClose(rec([block('b1', 1)], []), 'finish', s(300));
    expect(plan.blocks).toEqual([{ id: 'b1', changes: { deletedAt: s(300), updatedAt: s(300) } }]);
  });
});

describe('activity and staleness', () => {
  it('uses the latest updatedAt over Workout, blocks and Sets including soft-deleted ones', () => {
    const records = rec(
      [open, { ...deletedBlock, updatedAt: s(500) }],
      [{ ...saved1, updatedAt: s(55) }, deletedSet('sx', 2)],
    );
    expect(lastActivity(records)).toBe(s(500));
  });

  it('is stale exactly at 3 h', () => {
    const records = rec([open], [{ ...saved1, updatedAt: s(55) }]);
    expect(isStale(records, s(55) + AUTO_CLOSE_AFTER_MS - 1)).toBe(false);
    expect(isStale(records, s(55) + AUTO_CLOSE_AFTER_MS)).toBe(true);
  });
});

describe('pickRepsSuggestion', () => {
  const first = set('p', 'x', 1, { reps: 12 });
  it('uses the previous saved Set of the block', () => {
    const sets = [set('a', 'b1', 1, { reps: 7 }), set('b', 'b1', 2)];
    expect(pickRepsSuggestion(sets, 'b', first)).toBe(7);
  });
  it('uses the last Workout first Set for Set 1', () => {
    expect(pickRepsSuggestion([set('a', 'b1', 1)], 'a', first)).toBe(12);
  });
  it('falls back to 10', () => {
    expect(pickRepsSuggestion([set('a', 'b1', 1)], 'a', undefined)).toBe(10);
  });
});

describe('time math', () => {
  it('elapsedSec floors and clamps at 0', () => {
    expect(elapsedSec(s(10), T)).toBe(0);
    expect(elapsedSec(T, T + 754_999)).toBe(754);
  });
  it('restView counts down, then up', () => {
    expect(restView(T, 90, T + 1200)).toEqual({ phase: 'countdown', seconds: 89 });
    expect(restView(T, 90, s(90))).toEqual({ phase: 'overtime', seconds: 0 });
    expect(restView(T, 90, s(95))).toEqual({ phase: 'overtime', seconds: 5 });
    expect(restView(T, 0, T)).toEqual({ phase: 'overtime', seconds: 0 });
  });
});
