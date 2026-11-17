import type { ExerciseBlock, Workout, WorkoutSet } from '../data/types';

export const AUTO_CLOSE_AFTER_MS = 10_800_000;
export const DEFAULT_REPS = 10;
export const REPS_MAX = 999;
export const PLANNED_REST_MAX_SEC = 3600;

export interface WorkoutRecords {
  workout: Workout;
  blocks: ExerciseBlock[];
  sets: WorkoutSet[];
}

export type WorkoutStep =
  | { kind: 'picking' }
  | { kind: 'ready'; blockId: string }
  | { kind: 'set-running'; blockId: string; setId: string; startedAt: number }
  | {
      kind: 'reps-pending';
      blockId: string;
      setId: string;
      endedAt: number;
      plannedRestSec: number;
      repsSuggestion: number;
    }
  | { kind: 'resting'; blockId: string; setId: string; endedAt: number; plannedRestSec: number };

export type Intent =
  | { kind: 'openBlock' }
  | { kind: 'setPlannedRest'; blockId: string }
  | { kind: 'startSet'; blockId: string }
  | { kind: 'doneSet'; setId: string }
  | { kind: 'saveReps'; setId: string }
  | { kind: 'endBlock'; blockId: string };

export interface ClosePlan {
  workout: { id: string; changes: Partial<Workout> };
  blocks: { id: string; changes: Partial<ExerciseBlock> }[];
  sets: { id: string; changes: Partial<WorkoutSet> }[];
}

export function isSetSaved(set: WorkoutSet): boolean {
  return set.reps !== null;
}

export const isLive = (r: { deletedAt: number | null }) => r.deletedAt === null;
export const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

function liveSetsOf(sets: WorkoutSet[], blockId: string): WorkoutSet[] {
  return sets.filter((s) => s.blockId === blockId && isLive(s)).sort(byOrder);
}

function openBlocks(blocks: ExerciseBlock[]): ExerciseBlock[] {
  return blocks.filter((b) => isLive(b) && b.endedAt === null).sort(byOrder);
}

export function deriveStep({ blocks, sets }: WorkoutRecords): WorkoutStep {
  const block = openBlocks(blocks).at(-1);
  if (!block) return { kind: 'picking' };
  const last = liveSetsOf(sets, block.id).at(-1);
  if (!last) return { kind: 'ready', blockId: block.id };
  if (last.endedAt === null) {
    return {
      kind: 'set-running',
      blockId: block.id,
      setId: last.id,
      startedAt: last.startedAt ?? 0,
    };
  }
  if (!isSetSaved(last)) {
    return {
      kind: 'reps-pending',
      blockId: block.id,
      setId: last.id,
      endedAt: last.endedAt,
      plannedRestSec: last.plannedRestSec,
      repsSuggestion: DEFAULT_REPS,
    };
  }
  if (last.restEndedAt === null) {
    return {
      kind: 'resting',
      blockId: block.id,
      setId: last.id,
      endedAt: last.endedAt,
      plannedRestSec: last.plannedRestSec,
    };
  }
  return { kind: 'ready', blockId: block.id };
}

export function guardIntent(step: WorkoutStep, intent: Intent): 'invalid-transition' | null {
  const ok = (() => {
    switch (intent.kind) {
      case 'openBlock':
        return step.kind === 'picking';
      case 'setPlannedRest':
        return step.kind !== 'picking' && step.blockId === intent.blockId;
      case 'startSet':
      case 'endBlock':
        return (
          (step.kind === 'ready' || step.kind === 'resting') && step.blockId === intent.blockId
        );
      case 'doneSet':
        return step.kind === 'set-running' && step.setId === intent.setId;
      case 'saveReps':
        return step.kind === 'reps-pending' && step.setId === intent.setId;
    }
  })();
  return ok ? null : 'invalid-transition';
}

export function lastActivity({ workout, blocks, sets }: WorkoutRecords): number {
  return Math.max(
    workout.updatedAt,
    ...blocks.map((b) => b.updatedAt),
    ...sets.map((s) => s.updatedAt),
  );
}

export function isStale(r: WorkoutRecords, now: number): boolean {
  return now - lastActivity(r) >= AUTO_CLOSE_AFTER_MS;
}

export function planClose(r: WorkoutRecords, mode: 'finish' | 'auto', now: number): ClosePlan {
  const blocks = r.blocks.map((b) => ({ ...b }));
  const sets = r.sets.map((s) => ({ ...s }));
  const blockPatches = new Map<string, Partial<ExerciseBlock>>();
  const setPatches = new Map<string, Partial<WorkoutSet>>();

  const patchBlock = (b: ExerciseBlock, changes: Partial<ExerciseBlock>) => {
    const full = { ...changes, updatedAt: now };
    Object.assign(b, full);
    blockPatches.set(b.id, { ...blockPatches.get(b.id), ...full });
  };
  const patchSet = (s: WorkoutSet, changes: Partial<WorkoutSet>) => {
    const full = { ...changes, updatedAt: now };
    Object.assign(s, full);
    setPatches.set(s.id, { ...setPatches.get(s.id), ...full });
  };

  const open = openBlocks(blocks);

  for (const block of open) {
    const live = liveSetsOf(sets, block.id);
    const last = live.at(-1);
    if (last && !isSetSaved(last)) {
      patchSet(last, { deletedAt: now });
      const previous = live.at(-2);
      if (previous && previous.restEndedAt !== null && previous.restEndedAt === last.startedAt) {
        patchSet(previous, { restEndedAt: null });
      }
    }
  }

  const savedOf = (blockId: string) => liveSetsOf(sets, blockId).filter(isSetSaved);

  const times: number[] = [r.workout.startedAt];
  for (const block of blocks.filter(isLive)) {
    const saved = savedOf(block.id);
    const willBeDeleted = block.endedAt === null && saved.length === 0;
    if (willBeDeleted) continue;
    if (block.startedAt !== null) times.push(block.startedAt);
    if (block.endedAt !== null) times.push(block.endedAt);
    for (const s of saved) {
      if (s.startedAt !== null) times.push(s.startedAt);
      if (s.endedAt !== null) times.push(s.endedAt);
      if (s.restEndedAt !== null) times.push(s.restEndedAt);
    }
  }
  const closeTime = Math.max(now, ...times);

  for (const block of open) {
    const saved = savedOf(block.id);
    const lastSaved = saved.at(-1);
    if (!lastSaved) {
      patchBlock(block, { deletedAt: now });
      continue;
    }
    const blockEnd =
      mode === 'finish'
        ? closeTime
        : Math.max(lastSaved.endedAt ?? -Infinity, lastSaved.restEndedAt ?? -Infinity);
    patchBlock(block, { endedAt: blockEnd });
    if (lastSaved.restEndedAt === null) patchSet(lastSaved, { restEndedAt: blockEnd });
  }

  let workoutEnd = closeTime;
  let autoClosed = false;
  if (mode === 'auto') {
    autoClosed = true;
    const ends: number[] = [];
    for (const s of sets)
      if (isLive(s) && isSetSaved(s) && s.endedAt !== null) ends.push(s.endedAt);
    for (const b of blocks) if (isLive(b) && b.endedAt !== null) ends.push(b.endedAt);
    workoutEnd = ends.length > 0 ? Math.max(...ends) : r.workout.startedAt;
  }

  return {
    workout: {
      id: r.workout.id,
      changes: { endedAt: workoutEnd, autoClosed, updatedAt: now },
    },
    blocks: [...blockPatches].map(([id, changes]) => ({ id, changes })),
    sets: [...setPatches].map(([id, changes]) => ({ id, changes })),
  };
}

export function pickRepsSuggestion(
  currentBlockSets: WorkoutSet[],
  setId: string,
  lastWorkoutFirstSet: WorkoutSet | undefined,
): number {
  const live = currentBlockSets.filter(isLive).sort(byOrder);
  const index = live.findIndex((s) => s.id === setId);
  const before = (index < 0 ? live : live.slice(0, index)).filter(isSetSaved);
  const previous = before.at(-1);
  if (previous) return previous.reps ?? DEFAULT_REPS;
  return lastWorkoutFirstSet?.reps ?? DEFAULT_REPS;
}

export function elapsedSec(from: number, now: number): number {
  return Math.max(0, Math.floor((now - from) / 1000));
}

export function restView(
  endedAt: number,
  plannedRestSec: number,
  now: number,
): { phase: 'countdown' | 'overtime'; seconds: number } {
  const remaining = plannedRestSec * 1000 - Math.max(0, now - endedAt);
  if (remaining > 0) return { phase: 'countdown', seconds: Math.ceil(remaining / 1000) };
  // + 0 turns -0 into 0
  return { phase: 'overtime', seconds: Math.floor(-remaining / 1000) + 0 };
}
