import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { fakeWakeLock } from '../test-utils/fake-ports';
import { WakeLockProvider, useWakeLock } from './wakeLock';

function Probe() {
  useWakeLock(true);
  return null;
}

describe('useWakeLock', () => {
  it('releases the handle of the cleaned-up StrictMode run and keeps the live one', async () => {
    const fake = fakeWakeLock('manual');
    const view = render(
      <StrictMode>
        <WakeLockProvider port={fake.port}>
          <Probe />
        </WakeLockProvider>
      </StrictMode>,
    );
    expect(fake.requests()).toBe(2);
    await act(async () => {
      await fake.resolve(0);
      await fake.resolve(1);
    });
    expect(fake.handles[0]!.releases).toBe(1);
    expect(fake.handles[1]!.releases).toBe(0);
    view.unmount();
    expect(fake.handles[1]!.releases).toBe(1);
    expect(fake.handles[0]!.releases).toBe(1);
  });
});
