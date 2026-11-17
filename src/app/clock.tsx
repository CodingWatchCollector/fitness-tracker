import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface Clock {
  now(): number;
  subscribe(cb: () => void): () => void;
}

const TICK_MS = 250;

function createBrowserClock(): Clock {
  const subscribers = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    now: () => Date.now(),
    subscribe(cb) {
      subscribers.add(cb);
      timer ??= setInterval(() => {
        for (const subscriber of [...subscribers]) subscriber();
      }, TICK_MS);
      return () => {
        subscribers.delete(cb);
        if (subscribers.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}

export const browserClock: Clock = createBrowserClock();

const ClockContext = createContext<Clock>(browserClock);

export function ClockProvider({ clock, children }: { clock: Clock; children: ReactNode }) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export function useNow(): number {
  const clock = useContext(ClockContext);
  const [, setTick] = useState(0);
  useEffect(() => clock.subscribe(() => setTick((n) => n + 1)), [clock]);
  return clock.now();
}
