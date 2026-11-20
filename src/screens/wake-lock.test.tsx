import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../strings';
import { fakeWakeLock } from '../test-utils/fake-ports';
import { renderApp } from '../test-utils/render-app';
import { resetVisibility, setVisibility } from '../test-utils/visibility';
import { baseResting, closeFixtures, sec, setup } from '../test-utils/workout-fixtures';

const W = strings.workout;
const probe = () => screen.getByLabelText('location');

afterEach(() => {
  closeFixtures();
  resetVisibility();
});

async function renderBase(
  route: string,
  fake: ReturnType<typeof fakeWakeLock>,
  options: { skipBase?: boolean } = {},
) {
  setVisibility('visible');
  const f = await setup();
  if (!options.skipBase) await baseResting(f);
  f.clock.set(sec(60));
  renderApp(f.store, f.clock, route, { wakeLock: fake.port });
  return f;
}

describe('Wake Lock on the Workout screen', () => {
  it('holds the lock while visible, re-acquires on visible and releases on Finish', async () => {
    const user = userEvent.setup();
    const fake = fakeWakeLock('grant');
    await renderBase('/workout', fake);
    await screen.findByRole('timer', { name: W.restTimer });
    await waitFor(() => expect(fake.requests()).toBe(1));
    expect(fake.handles[0]!.releases).toBe(0);

    await act(async () => setVisibility('hidden'));
    expect(fake.handles[0]!.releases).toBe(1);
    expect(fake.requests()).toBe(1);

    await act(async () => setVisibility('visible'));
    await waitFor(() => expect(fake.requests()).toBe(2));
    expect(fake.handles[1]!.releases).toBe(0);

    await act(async () => setVisibility('visible'));
    expect(fake.requests()).toBe(2);

    await user.click(screen.getByRole('button', { name: W.finish }));
    await user.click(await screen.findByRole('button', { name: W.finishDialog.confirm }));
    await waitFor(() => expect(probe().textContent).toBe('/'));
    expect(fake.handles[1]!.releases).toBe(1);
    expect(fake.requests()).toBe(2);
  });

  it.each(['/', '/exercises'])('does not request on %s', async (route) => {
    const fake = fakeWakeLock('grant');
    await renderBase(route, fake);
    await screen.findByRole('banner');
    await act(async () => {});
    expect(fake.requests()).toBe(0);
  });

  it('redirects without a request when there is no active Workout', async () => {
    const fake = fakeWakeLock('grant');
    await renderBase('/workout', fake, { skipBase: true });
    await waitFor(() => expect(probe().textContent).toBe('/'));
    expect(fake.requests()).toBe(0);
  });

  it('releases the lock when the user leaves through the title link', async () => {
    const user = userEvent.setup();
    const fake = fakeWakeLock('grant');
    await renderBase('/workout', fake);
    await screen.findByRole('timer', { name: W.restTimer });
    await waitFor(() => expect(fake.requests()).toBe(1));
    await user.click(screen.getByRole('link', { name: strings.appName }));
    expect(probe().textContent).toBe('/');
    expect(fake.handles[0]!.releases).toBe(1);
  });

  it('releases a handle that resolves after the user left', async () => {
    const user = userEvent.setup();
    const fake = fakeWakeLock('manual');
    await renderBase('/workout', fake);
    await screen.findByRole('timer', { name: W.restTimer });
    await user.click(screen.getByRole('link', { name: strings.appName }));
    await act(async () => fake.resolve(0));
    expect(fake.handles[0]!.releases).toBe(1);
    expect(fake.requests()).toBe(1);
  });

  it('releases a handle that resolves while hidden and re-requests on visible', async () => {
    const fake = fakeWakeLock('manual');
    await renderBase('/workout', fake);
    await screen.findByRole('timer', { name: W.restTimer });
    await act(async () => setVisibility('hidden'));
    await act(async () => fake.resolve(0));
    expect(fake.handles[0]!.releases).toBe(1);
    await act(async () => setVisibility('visible'));
    expect(fake.requests()).toBe(2);
  });

  it('shows no error when the lock is denied', async () => {
    const fake = fakeWakeLock('deny');
    await renderBase('/workout', fake);
    expect(await screen.findByRole('timer', { name: W.restTimer })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible'));
    expect(fake.requests()).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('swallows rejecting release calls', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const fake = fakeWakeLock('grant', { rejectRelease: true });
      await renderBase('/workout', fake);
      await screen.findByRole('timer', { name: W.restTimer });
      await waitFor(() => expect(fake.requests()).toBe(1));

      await act(async () => setVisibility('hidden'));
      expect(fake.handles[0]!.releases).toBe(1);
      expect(screen.queryByRole('alert')).toBeNull();

      await act(async () => setVisibility('visible'));
      expect(fake.requests()).toBe(2);
      expect(fake.handles[1]!.releases).toBe(0);

      cleanup();
      expect(fake.handles[1]!.releases).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
