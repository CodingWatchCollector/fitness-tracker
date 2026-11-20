import type { WorkoutStep } from './machine';

export const REST_WARNING_MS = 10_000;
export const ALERT_LATE_MS = 2_000;
export const FLASH_LATE_MAX_MS = 60_000;
export const FLASH_MS = 1_000;

export type RestStage = 'counting' | 'warning' | 'ended';

export interface RestInput {
  setId: string;
  endedAt: number;
  plannedRestSec: number;
}

export interface RestAlert {
  kind: 'warning' | 'end';
  audible: boolean;
  flash: boolean;
}

const RANK: Record<RestStage, number> = { counting: 0, warning: 1, ended: 2 };

export function restStage(endedAt: number, plannedRestSec: number, now: number): RestStage {
  const remaining = plannedRestSec * 1000 - Math.max(0, now - endedAt);
  if (remaining > REST_WARNING_MS) return 'counting';
  return remaining > 0 ? 'warning' : 'ended';
}

export function restAlertDue(
  previous: RestStage,
  endedAt: number,
  plannedRestSec: number,
  now: number,
): RestAlert | null {
  const stage = restStage(endedAt, plannedRestSec, now);
  if (RANK[stage] <= RANK[previous]) return null;
  const kind = stage === 'ended' ? 'end' : 'warning';
  const endAt = endedAt + plannedRestSec * 1000;
  const lateMs = now - (kind === 'end' ? endAt : endAt - REST_WARNING_MS);
  return {
    kind,
    audible: lateMs <= ALERT_LATE_MS,
    flash: kind === 'end' && lateMs <= FLASH_LATE_MAX_MS,
  };
}

export function restInputOf(step: WorkoutStep): RestInput | null {
  if (step.kind !== 'reps-pending' && step.kind !== 'resting') return null;
  return { setId: step.setId, endedAt: step.endedAt, plannedRestSec: step.plannedRestSec };
}
