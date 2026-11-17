export interface TestClock {
  now(): number;
  subscribe(cb: () => void): () => void;
  set(ms: number): void;
  advance(ms: number): void;
  tick(): void;
}

export function testClock(start: number): TestClock {
  let current = start;
  const subscribers = new Set<() => void>();
  return {
    now: () => current,
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    set(ms) {
      current = ms;
    },
    advance(ms) {
      current += ms;
    },
    tick() {
      for (const cb of [...subscribers]) cb();
    },
  };
}
