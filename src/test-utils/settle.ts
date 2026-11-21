import { act } from '@testing-library/react';

let flush: (() => void) | null = null;

export function registerFlush(fn: () => void): () => void {
  flush = fn;
  return () => {
    if (flush === fn) flush = null;
  };
}

/**
 * An empty act schedules no work on the root, so passive effects queued outside act stay on the
 * Scheduler. An update on the app tree makes React flush them before it renders.
 */
export async function settle(): Promise<void> {
  const fn = flush;
  if (!fn) return;
  await act(async () => {
    fn();
  });
}
