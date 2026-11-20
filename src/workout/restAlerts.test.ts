// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkoutStep } from './machine';
import { restView } from './machine';
import { restAlertDue, restInputOf, restStage, type RestStage } from './restAlerts';

const T = 1_700_000_000_000;
const ms = (s: number) => Math.round(s * 1000);

describe('restStage', () => {
  const rows: [string, number, number, RestStage][] = [
    ['T', 90, 0, 'counting'],
    ['T+79.999s', 90, 79.999, 'counting'],
    ['T+80s', 90, 80, 'warning'],
    ['T+89.999s', 90, 89.999, 'warning'],
    ['T+90s', 90, 90, 'ended'],
    ['T-5s', 90, -5, 'counting'],
    ['planned 5 at T', 5, 0, 'warning'],
    ['planned 0 at T', 0, 0, 'ended'],
  ];
  it.each(rows)('%s -> %s', (_label, planned, at, expected) => {
    expect(restStage(T, planned, T + ms(at))).toBe(expected);
  });

  it.each(rows)('matches restView overtime for %s', (_label, planned, at) => {
    const now = T + ms(at);
    expect(restView(T, planned, now).phase === 'overtime').toBe(
      restStage(T, planned, now) === 'ended',
    );
  });
});

describe('restAlertDue', () => {
  const rows: [RestStage, number, number, ReturnType<typeof restAlertDue>][] = [
    ['counting', 90, 79.999, null],
    ['counting', 90, 80, { kind: 'warning', audible: true, flash: false }],
    ['counting', 90, 82, { kind: 'warning', audible: true, flash: false }],
    ['counting', 90, 82.001, { kind: 'warning', audible: false, flash: false }],
    ['warning', 90, 89.999, null],
    ['warning', 90, 90, { kind: 'end', audible: true, flash: true }],
    ['warning', 90, 92, { kind: 'end', audible: true, flash: true }],
    ['warning', 90, 92.001, { kind: 'end', audible: false, flash: true }],
    ['counting', 90, 90.5, { kind: 'end', audible: true, flash: true }],
    ['counting', 90, 95, { kind: 'end', audible: false, flash: true }],
    ['counting', 90, 150, { kind: 'end', audible: false, flash: true }],
    ['counting', 90, 150.001, { kind: 'end', audible: false, flash: false }],
    ['ended', 90, 100, null],
    ['ended', 120, 100, null],
    ['warning', 120, 100, null],
  ];
  it.each(rows)('(%s, %i, T+%fs)', (previous, planned, at, expected) => {
    expect(restAlertDue(previous, T, planned, T + ms(at))).toEqual(expected);
  });
});

describe('restInputOf', () => {
  it('returns the rest anchor for reps-pending and resting', () => {
    const pending: WorkoutStep = {
      kind: 'reps-pending',
      blockId: 'b1',
      setId: 's1',
      endedAt: T,
      plannedRestSec: 75,
      repsSuggestion: 10,
    };
    const resting: WorkoutStep = {
      kind: 'resting',
      blockId: 'b1',
      setId: 's1',
      endedAt: T,
      plannedRestSec: 90,
    };
    expect(restInputOf(pending)).toEqual({ setId: 's1', endedAt: T, plannedRestSec: 75 });
    expect(restInputOf(resting)).toEqual({ setId: 's1', endedAt: T, plannedRestSec: 90 });
  });

  it('returns null for the other steps', () => {
    const steps: WorkoutStep[] = [
      { kind: 'picking' },
      { kind: 'ready', blockId: 'b1' },
      { kind: 'set-running', blockId: 'b1', setId: 's1', startedAt: T },
    ];
    for (const step of steps) expect(restInputOf(step)).toBeNull();
  });
});
