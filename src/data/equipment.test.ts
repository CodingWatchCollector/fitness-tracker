import { afterEach, describe, expect, it } from 'vitest';
import { WorkoutStateError, type WorkoutStateErrorCode } from '../data';
import { H3, baseResting, closeFixtures, sec, setup } from '../test-utils/workout-fixtures';

afterEach(closeFixtures);

async function rejectsWith(promise: Promise<unknown>, code: WorkoutStateErrorCode) {
  const error = await promise.then(() => null).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(WorkoutStateError);
  expect((error as WorkoutStateError).code).toBe(code);
}

describe('Equipment items', () => {
  it('adds, lists sorted, updates and soft deletes', async () => {
    const f = await setup();
    f.clock.set(sec(1));
    const red = await f.store.equipment.add({ name: '  Red   band ', nominalKg: 15 });
    f.clock.set(sec(2));
    await f.store.equipment.add({ name: 'blue band', nominalKg: 7.5 });

    expect((await f.store.equipment.list()).map((e) => e.name)).toEqual(['blue band', 'Red band']);
    expect(await f.equipmentItems.get(red.id)).toEqual({
      id: red.id,
      name: 'Red band',
      nominalKg: 15,
      createdAt: sec(1),
      updatedAt: sec(1),
      deletedAt: null,
    });
    expect(red.id).toMatch(/^[0-9a-f-]{36}$/);

    f.clock.set(sec(3));
    await f.store.equipment.update(red.id, { name: 'Red band', nominalKg: 20 });
    expect(await f.equipmentItems.get(red.id)).toEqual({
      id: red.id,
      name: 'Red band',
      nominalKg: 20,
      createdAt: sec(1),
      updatedAt: sec(3),
      deletedAt: null,
    });

    f.clock.set(sec(4));
    await f.store.equipment.remove(red.id);
    expect((await f.store.equipment.list()).map((e) => e.name)).toEqual(['blue band']);
    expect(await f.equipmentItems.get(red.id)).toEqual({
      id: red.id,
      name: 'Red band',
      nominalKg: 20,
      createdAt: sec(1),
      updatedAt: sec(4),
      deletedAt: sec(4),
    });
    await expect(f.store.equipment.add({ name: 'RED BAND', nominalKg: 15 })).resolves.toMatchObject(
      { name: 'RED BAND', nominalKg: 15 },
    );
  });

  it('rejects invalid input and writes nothing', async () => {
    const f = await setup();
    f.clock.set(sec(1));
    await f.store.equipment.add({ name: 'blue band', nominalKg: 7.5 });
    const other = await f.store.equipment.add({ name: 'green band', nominalKg: 5 });
    f.clock.set(sec(2));
    await f.store.equipment
      .add({ name: 'gone', nominalKg: 5 })
      .then((e) => f.store.equipment.remove(e.id));
    const before = await f.dumpAll();
    const gone = before.equipmentItems.find((e) => e.name === 'gone')!;
    const eq = f.store.equipment;

    const cases: [() => Promise<unknown>, WorkoutStateErrorCode][] = [
      [() => eq.add({ name: '   ', nominalKg: 5 }), 'invalid-value'],
      [() => eq.add({ name: 'x'.repeat(41), nominalKg: 5 }), 'invalid-value'],
      [() => eq.add({ name: 'ok', nominalKg: 0 }), 'invalid-value'],
      [() => eq.add({ name: 'ok', nominalKg: 0.3 }), 'invalid-value'],
      [() => eq.add({ name: 'ok', nominalKg: 500.5 }), 'invalid-value'],
      [() => eq.add({ name: 'ok', nominalKg: NaN }), 'invalid-value'],
      [() => eq.add({ name: 'ok', nominalKg: Infinity }), 'invalid-value'],
      [() => eq.add({ name: 'BLUE BAND', nominalKg: 5 }), 'duplicate-name'],
      [() => eq.update(other.id, { name: 'Blue Band', nominalKg: 5 }), 'duplicate-name'],
      [() => eq.update(other.id, { name: 'x'.repeat(41), nominalKg: 5 }), 'invalid-value'],
      [() => eq.update(other.id, { name: 'ok', nominalKg: 0.3 }), 'invalid-value'],
      [() => eq.update('unknown', { name: 'ok', nominalKg: 5 }), 'equipment-not-found'],
      [() => eq.update(gone.id, { name: 'ok', nominalKg: 5 }), 'equipment-not-found'],
      [() => eq.remove('unknown'), 'equipment-not-found'],
      [() => eq.remove(gone.id), 'equipment-not-found'],
    ];
    for (const [run, code] of cases) await rejectsWith(run(), code);

    expect(await f.dumpAll()).toEqual(before);
  });

  it('lets an item keep its own name on update', async () => {
    const f = await setup();
    f.clock.set(sec(1));
    const blue = await f.store.equipment.add({ name: 'blue band', nominalKg: 7.5 });
    await expect(
      f.store.equipment.update(blue.id, { name: 'BLUE band', nominalKg: 10 }),
    ).resolves.toMatchObject({ name: 'BLUE band', nominalKg: 10 });
  });

  it('accepts the boundary values', async () => {
    const f = await setup();
    const eq = f.store.equipment;
    await expect(eq.add({ name: 'a', nominalKg: 0.5 })).resolves.toMatchObject({ nominalKg: 0.5 });
    await expect(eq.add({ name: 'b', nominalKg: 500 })).resolves.toMatchObject({ nominalKg: 500 });
    const long = 'x'.repeat(40);
    await expect(eq.add({ name: long, nominalKg: 5 })).resolves.toMatchObject({ name: long });
  });

  it('does not move autoCloseAt', async () => {
    const f = await setup();
    await baseResting(f);
    f.clock.set(sec(60));
    await f.store.equipment.add({ name: 'Red band', nominalKg: 15 });
    const current = await f.store.workouts.current();
    expect(current).not.toBeNull();
    expect(current!.autoCloseAt).toBe(sec(55) + H3);
  });
});
