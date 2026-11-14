// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { openDataStore } from './index';
import { rawOpenVersion } from '../test-utils/raw-idb';

async function seeded() {
  const name = crypto.randomUUID();
  const store = openDataStore({ name });
  await store.ensureSeeded();
  return { name, store };
}

describe('version change', () => {
  it('calls a subscribed callback once and closes the store', async () => {
    const { name, store } = await seeded();
    const cb = vi.fn();
    store.onVersionChange(cb);

    await rawOpenVersion(name, 20);

    expect(cb).toHaveBeenCalledTimes(1);
    await expect(store.exercises.list()).rejects.toThrow();
  });

  it('does not call an unsubscribed callback', async () => {
    const { name, store } = await seeded();
    const cb = vi.fn();
    const unsubscribe = store.onVersionChange(cb);
    unsubscribe();

    await rawOpenVersion(name, 20);

    expect(cb).not.toHaveBeenCalled();
  });
});
