import type { Exercise } from '../data';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  name: string,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (os: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await request(indexedDB.open(name));
  try {
    const tx = db.transaction(storeName, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const result = await fn(tx.objectStore(storeName));
    await done;
    return result;
  } finally {
    db.close();
  }
}

export type RawStoreName = 'workouts' | 'exerciseBlocks' | 'sets' | 'equipmentItems' | 'tags';

export function rawStore<T>(name: string, storeName: RawStoreName) {
  return {
    get: (id: string) =>
      withStore(name, storeName, 'readonly', (os) =>
        request(os.get(id) as IDBRequest<T | undefined>),
      ),
    getAll: () =>
      withStore(name, storeName, 'readonly', (os) => request(os.getAll() as IDBRequest<T[]>)),
    put: (record: T) =>
      withStore(name, storeName, 'readwrite', async (os) => {
        await request(os.put(record));
      }),
  };
}

const withExercises = <T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (os: IDBObjectStore) => Promise<T>,
) => withStore(name, 'exercises', mode, fn);

export const rawExercises = {
  get: (name: string, id: string) =>
    withExercises(name, 'readonly', (os) =>
      request(os.get(id) as IDBRequest<Exercise | undefined>),
    ),
  getAll: (name: string) =>
    withExercises(name, 'readonly', (os) => request(os.getAll() as IDBRequest<Exercise[]>)),
  put: (name: string, record: Exercise) =>
    withExercises(name, 'readwrite', async (os) => {
      await request(os.put(record));
    }),
  delete: (name: string, id: string) =>
    withExercises(name, 'readwrite', async (os) => {
      await request(os.delete(id));
    }),
};

export function rawOpenVersion(name: string, version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}
