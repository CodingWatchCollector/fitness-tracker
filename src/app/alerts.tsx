import { createContext, useContext, useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useClock } from './clock';
import {
  FLASH_MS,
  restAlertDue,
  restStage,
  type RestInput,
  type RestStage,
} from '../workout/restAlerts';

export interface Alerts {
  unlock(): void;
  restWarning(): void;
  restEnd(): void;
}

export const BEEP_HZ = 880;
export const BEEP_SHORT_MS = 200;
export const BEEP_LONG_MS = 800;
export const BEEP_GAIN = 0.3;
export const VIBRATION_PATTERN: readonly number[] = [400, 100, 400];

export interface AlertsEnv {
  AudioContext?: new () => AudioContext;
  vibrate?: (pattern: readonly number[]) => boolean;
}

export function createBrowserAlerts(env: () => AlertsEnv): Alerts {
  let ctx: AudioContext | null = null;

  const resume = (context: AudioContext) => {
    try {
      context.resume().catch(() => undefined);
    } catch {
      // a failing resume only means the tone is skipped
    }
  };

  const tone = (ms: number) => {
    if (!ctx) return;
    if (ctx.state !== 'running') {
      resume(ctx);
      return;
    }
    try {
      const t = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = BEEP_HZ;
      gain.gain.value = BEEP_GAIN;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(t);
      oscillator.stop(t + ms / 1000);
    } catch {
      // audio is best effort
    }
  };

  return {
    unlock() {
      try {
        if (!ctx) {
          const Context = env().AudioContext;
          if (!Context) return;
          ctx = new Context();
        }
        if (ctx.state !== 'running') resume(ctx);
      } catch {
        // audio is best effort
      }
    },
    restWarning() {
      tone(BEEP_SHORT_MS);
    },
    restEnd() {
      try {
        env().vibrate?.(VIBRATION_PATTERN);
      } catch {
        // vibration is best effort
      }
      tone(BEEP_LONG_MS);
    },
  };
}

export const browserAlerts: Alerts = createBrowserAlerts(() => ({
  AudioContext: globalThis.AudioContext,
  vibrate:
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? (pattern) => navigator.vibrate([...pattern])
      : undefined,
}));

const AlertsContext = createContext<Alerts>(browserAlerts);

export function AlertsProvider({
  alerts,
  children,
}: {
  alerts: Alerts;
  children: ReactNode;
}): JSX.Element {
  useEffect(() => {
    const unlock = () => alerts.unlock();
    document.addEventListener('pointerup', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('pointerup', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, [alerts]);
  return <AlertsContext.Provider value={alerts}>{children}</AlertsContext.Provider>;
}

export function useAlerts(): Alerts {
  return useContext(AlertsContext);
}

export function useRestAlerts(rest: RestInput | null): { flashing: boolean } {
  const clock = useClock();
  const alerts = useAlerts();
  const [flashing, setFlashing] = useState(false);
  const setId = rest?.setId ?? null;
  const endedAt = rest?.endedAt ?? null;
  const plannedRestSec = rest?.plannedRestSec ?? null;

  useEffect(() => {
    if (setId === null || endedAt === null || plannedRestSec === null) return;
    let previous: RestStage = restStage(endedAt, plannedRestSec, clock.now());
    return clock.subscribe(() => {
      if (document.visibilityState !== 'visible') return;
      const now = clock.now();
      const due = restAlertDue(previous, endedAt, plannedRestSec, now);
      if (!due) return;
      previous = due.kind === 'end' ? 'ended' : 'warning';
      if (due.audible) {
        if (due.kind === 'end') alerts.restEnd();
        else alerts.restWarning();
      }
      if (due.flash) setFlashing(true);
    });
  }, [setId, endedAt, plannedRestSec, clock, alerts]);

  useEffect(() => {
    if (!flashing) return;
    const start = clock.now();
    return clock.subscribe(() => {
      if (clock.now() - start >= FLASH_MS) setFlashing(false);
    });
  }, [flashing, clock]);

  return { flashing };
}
