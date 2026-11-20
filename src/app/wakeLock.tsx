import { createContext, useContext, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';

export interface WakeLockHandle {
  release(): Promise<void>;
}

export interface WakeLockPort {
  request(): Promise<WakeLockHandle | null>;
}

export function createBrowserWakeLock(
  nav: () => { wakeLock?: WakeLock } | undefined,
): WakeLockPort {
  return {
    request() {
      const wakeLock = nav()?.wakeLock;
      if (!wakeLock) return Promise.resolve(null);
      try {
        return wakeLock
          .request('screen')
          .then((sentinel): WakeLockHandle => ({ release: () => sentinel.release() }))
          .catch(() => null);
      } catch {
        return Promise.resolve(null);
      }
    },
  };
}

export const browserWakeLock: WakeLockPort = createBrowserWakeLock(() => globalThis.navigator);

const WakeLockContext = createContext<WakeLockPort>(browserWakeLock);

export function WakeLockProvider({
  port,
  children,
}: {
  port: WakeLockPort;
  children: ReactNode;
}): JSX.Element {
  return <WakeLockContext.Provider value={port}>{children}</WakeLockContext.Provider>;
}

function releaseQuietly(handle: WakeLockHandle) {
  try {
    handle.release().catch(() => undefined);
  } catch {
    // releasing is best effort
  }
}

export function useWakeLock(active: boolean): void {
  const port = useContext(WakeLockContext);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let pending = false;
    let handle: WakeLockHandle | null = null;

    const acquire = () => {
      if (document.visibilityState !== 'visible' || handle || pending) return;
      pending = true;
      port
        .request()
        .then((granted) => {
          pending = false;
          if (!granted) return;
          if (disposed || document.visibilityState !== 'visible') releaseQuietly(granted);
          else handle = granted;
        })
        .catch(() => {
          pending = false;
        });
    };

    const releaseHeld = () => {
      if (!handle) return;
      const held = handle;
      handle = null;
      releaseQuietly(held);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
      else releaseHeld();
    };

    document.addEventListener('visibilitychange', onVisibility);
    acquire();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      releaseHeld();
    };
  }, [active, port]);
}
