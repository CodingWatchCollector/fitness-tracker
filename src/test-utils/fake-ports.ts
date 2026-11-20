import type { Alerts } from '../app/alerts';
import type { WakeLockPort } from '../app/wakeLock';

export type AlertCall = 'unlock' | 'restWarning' | 'restEnd';

export function recordingAlerts() {
  const calls: AlertCall[] = [];
  const alerts: Alerts = {
    unlock: () => void calls.push('unlock'),
    restWarning: () => void calls.push('restWarning'),
    restEnd: () => void calls.push('restEnd'),
  };
  return {
    alerts,
    calls,
    alertCalls: () => calls.filter((call) => call !== 'unlock'),
  };
}

export interface FakeHandle {
  releases: number;
}

export function fakeWakeLock(
  mode: 'grant' | 'deny' | 'manual' = 'grant',
  options: { rejectRelease?: boolean } = {},
) {
  const handles: (FakeHandle & { release(): Promise<void> })[] = [];
  const pendingResolvers: ((handle: FakeHandle & { release(): Promise<void> }) => void)[] = [];
  let requestCount = 0;

  const newHandle = () => {
    const handle = {
      releases: 0,
      release(): Promise<void> {
        handle.releases += 1;
        return options.rejectRelease
          ? Promise.reject(new Error('release failed'))
          : Promise.resolve();
      },
    };
    handles.push(handle);
    return handle;
  };

  const port: WakeLockPort = {
    request() {
      requestCount += 1;
      if (mode === 'deny') return Promise.resolve(null);
      const handle = newHandle();
      if (mode === 'grant') return Promise.resolve(handle);
      return new Promise((resolve) => {
        pendingResolvers[handles.length - 1] = () => resolve(handle);
      });
    },
  };

  return {
    port,
    requests: () => requestCount,
    handles: handles as FakeHandle[],
    async resolve(index: number): Promise<void> {
      pendingResolvers[index]?.(handles[index]!);
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    },
  };
}
