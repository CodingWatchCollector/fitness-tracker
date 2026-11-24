import type { FitnessDb } from './db';
import type { EquipmentItem } from './types';
import { WorkoutStateError } from './workouts';

export interface EquipmentItemInput {
  name: string;
  nominalKg: number;
}

export const EQUIPMENT_NAME_MAX = 40;
export const LOAD_KG_MIN = 0.5;
export const LOAD_KG_MAX = 500;

export function normalizeLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export function labelKey(s: string): string {
  return normalizeLabel(s).toLocaleLowerCase('en');
}

export function isValidKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= LOAD_KG_MIN && kg <= LOAD_KG_MAX && Number.isInteger(kg * 2);
}

export interface EquipmentApi {
  list(): Promise<EquipmentItem[]>;
  add(input: EquipmentItemInput): Promise<EquipmentItem>;
  update(id: string, input: EquipmentItemInput): Promise<EquipmentItem>;
  remove(id: string): Promise<void>;
}

export function isValidEquipmentInput(input: EquipmentItemInput): boolean {
  const length = normalizeLabel(input.name).length;
  return length >= 1 && length <= EQUIPMENT_NAME_MAX && isValidKg(input.nominalKg);
}

function validate(input: EquipmentItemInput): EquipmentItemInput {
  if (!isValidEquipmentInput(input)) throw new WorkoutStateError('invalid-value');
  return { name: normalizeLabel(input.name), nominalKg: input.nominalKg };
}

export function createEquipment(
  db: FitnessDb,
  ready: Promise<void>,
  now: () => number,
): EquipmentApi {
  const live = async () => (await db.equipmentItems.toArray()).filter((e) => e.deletedAt === null);

  async function liveOrThrow(id: string): Promise<EquipmentItem> {
    const found = await db.equipmentItems.get(id);
    if (!found || found.deletedAt !== null) throw new WorkoutStateError('equipment-not-found');
    return found;
  }

  async function assertUnique(name: string, exceptId?: string) {
    const key = labelKey(name);
    const clash = (await live()).some((e) => e.id !== exceptId && labelKey(e.name) === key);
    if (clash) throw new WorkoutStateError('duplicate-name');
  }

  return {
    async list() {
      await ready;
      const items = await db.transaction('r', db.equipmentItems, live);
      return items.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    },
    async add(input) {
      await ready;
      return db.transaction('rw', db.equipmentItems, async () => {
        const { name, nominalKg } = validate(input);
        await assertUnique(name);
        const t = now();
        const item: EquipmentItem = {
          id: crypto.randomUUID(),
          name,
          nominalKg,
          createdAt: t,
          updatedAt: t,
          deletedAt: null,
        };
        await db.equipmentItems.add(item);
        return item;
      });
    },
    async update(id, input) {
      await ready;
      return db.transaction('rw', db.equipmentItems, async () => {
        const { name, nominalKg } = validate(input);
        const existing = await liveOrThrow(id);
        await assertUnique(name, id);
        const item: EquipmentItem = { ...existing, name, nominalKg, updatedAt: now() };
        await db.equipmentItems.put(item);
        return item;
      });
    },
    async remove(id) {
      await ready;
      await db.transaction('rw', db.equipmentItems, async () => {
        const existing = await liveOrThrow(id);
        const t = now();
        await db.equipmentItems.put({ ...existing, updatedAt: t, deletedAt: t });
      });
    },
  };
}
