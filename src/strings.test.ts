// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { strings } from './strings';

describe('strings', () => {
  it('formats clock values', () => {
    const inputs = [0, 5, 59, 60, 754, 3599, 3600, 3723, 36000];
    expect(inputs.map(strings.clock)).toEqual([
      '0:00',
      '0:05',
      '0:59',
      '1:00',
      '12:34',
      '59:59',
      '1:00:00',
      '1:02:03',
      '10:00:00',
    ]);
  });

  it('pluralises Set lines', () => {
    expect(strings.workout.setLine(1, 12)).toBe('Set 1: 12 reps');
    expect(strings.workout.setLine(2, 1)).toBe('Set 2: 1 rep');
    expect(strings.workout.setLine(3, 0)).toBe('Set 3: 0 reps');
  });

  it('keeps one entry per rest phase and end-block context', () => {
    expect(strings.workout.restPhase.countdown).toBe('Rest');
    expect(strings.workout.restPhase.overtime).toBe('Overtime');
    expect(strings.workout.overtime('0:05')).toBe('+0:05');
    expect(strings.workout.endBlock.ready).not.toBe(strings.workout.endBlock.resting);
  });

  it('formats Equipment item text', () => {
    expect(strings.home.equipment).toBe('Equipment items');
    expect(strings.equipment.nominal(15)).toBe('15 kg');
    expect(strings.equipment.nominal(7.5)).toBe('7.5 kg');
    expect(strings.equipment.deleted('Red band')).toBe('Red band (deleted)');
    expect(strings.equipment.edit('Red band')).toBe('Edit Red band');
    expect(strings.equipment.delete('Red band')).toBe('Delete Red band');
    expect(strings.equipment.deleteDialog.title('Red band')).toBe('Delete Red band?');
  });
});
