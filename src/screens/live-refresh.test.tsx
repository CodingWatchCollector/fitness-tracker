import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActiveWorkout } from '../data';
import { strings } from '../strings';
import { fakeWakeLock } from '../test-utils/fake-ports';
import { countingWorkouts, deferred, renderApp } from '../test-utils/render-app';
import { settle } from '../test-utils/settle';
import { resetVisibility, setVisibility } from '../test-utils/visibility';
import {
  H3,
  baseResting,
  closeFixtures,
  openStoreOn,
  sec,
  setup,
  tick,
} from '../test-utils/workout-fixtures';

const W = strings.workout;
const probe = () => screen.getByLabelText('location');
const AUTO_CLOSE = sec(55) + H3;

afterEach(() => {
  cleanup();
  closeFixtures();
  resetVisibility();
});

async function renderBase() {
  setVisibility('visible');
  const f = await setup();
  await baseResting(f);
  f.clock.set(sec(60));
  return f;
}

describe('live auto-close on the tick', () => {
  it('reads once on mount and not again while ticks stay before autoCloseAt', async () => {
    const f = await renderBase();
    const c = countingWorkouts(f.store);
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    for (let s = 61; s <= 80; s += 1) await tick(f, sec(s));
    await settle();
    expect(c.calls()).toBe(1);
  });

  it('closes at autoCloseAt, redirects Home and releases the Wake Lock', async () => {
    const f = await renderBase();
    const fake = fakeWakeLock('grant');
    const c = countingWorkouts(f.store);
    renderApp(c.store, f.clock, '/workout', { wakeLock: fake.port });
    await screen.findByRole('timer', { name: W.restTimer });
    await waitFor(() => expect(fake.requests()).toBe(1));

    await tick(f, AUTO_CLOSE - 1);
    await settle();
    expect(screen.getByRole('timer', { name: W.restTimer })).toBeInTheDocument();
    expect(c.calls()).toBe(1);

    await tick(f, AUTO_CLOSE);
    await waitFor(() => expect(probe().textContent).toBe('/'));
    expect(await screen.findByRole('button', { name: strings.home.startWorkout })).toBeVisible();
    const [workout] = (await f.dump()).workouts;
    expect(workout!.autoClosed).toBe(true);
    expect(workout!.endedAt).toBe(sec(50));
    expect(fake.handles[0]!.releases).toBe(1);
  });

  it('reads once per autoCloseAt when the Workout stays open', async () => {
    const f = await renderBase();
    const snapshot = await f.store.workouts.current();
    const c = countingWorkouts(f.store, (n) =>
      n === 1 ? f.store.workouts.current() : Promise.resolve(snapshot),
    );
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    await tick(f, AUTO_CLOSE);
    await waitFor(() => expect(c.calls()).toBe(2));
    await settle();
    await tick(f, AUTO_CLOSE + 250);
    await settle();
    await tick(f, AUTO_CLOSE + 500);
    await settle();
    expect(c.calls()).toBe(2);
  });

  it('follows autoCloseAt when a planned rest change moves it', async () => {
    const user = userEvent.setup();
    const f = await renderBase();
    renderApp(f.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    f.clock.set(sec(1000));
    await user.click(screen.getByRole('button', { name: W.restLess }));
    await waitFor(() => expect(screen.getByLabelText(W.plannedRest)).toHaveTextContent('1:15'));

    await tick(f, AUTO_CLOSE);
    await settle();
    expect(screen.getByRole('timer', { name: W.restTimer })).toBeInTheDocument();

    await tick(f, sec(1000) + H3);
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });

  it('flips Home from Resume to Start at autoCloseAt', async () => {
    const f = await renderBase();
    renderApp(f.store, f.clock, '/');
    await screen.findByText(strings.home.inProgress);
    await tick(f, AUTO_CLOSE);
    expect(await screen.findByRole('button', { name: strings.home.startWorkout })).toBeVisible();
  });

  it('does not read on the tick while the page is hidden, then reads when visible', async () => {
    const f = await renderBase();
    const c = countingWorkouts(f.store);
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    await settle();
    act(() => setVisibility('hidden'));
    await tick(f, AUTO_CLOSE);
    await settle();
    expect(c.calls()).toBe(1);
    expect(screen.getByRole('timer', { name: W.restTimer })).toBeInTheDocument();

    await settle();
    act(() => setVisibility('visible'));
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });
});

describe('re-read when the page becomes visible', () => {
  it('sees a Finish from another store only once the page is visible again', async () => {
    const f = await renderBase();
    const c = countingWorkouts(f.store);
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    const other = openStoreOn(f.name, f.clock);
    f.clock.set(sec(100));
    await other.workouts.finish();

    await settle();
    act(() => setVisibility('hidden'));
    await settle();
    expect(c.calls()).toBe(1);
    expect(screen.getByRole('timer', { name: W.restTimer })).toBeInTheDocument();

    await settle();
    act(() => setVisibility('visible'));
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });

  it('shows a Workout started elsewhere on Home', async () => {
    setVisibility('visible');
    const f = await setup();
    renderApp(f.store, f.clock, '/');
    await screen.findByRole('button', { name: strings.home.startWorkout });
    const other = openStoreOn(f.name, f.clock);
    f.clock.set(sec(100));
    await other.workouts.start();

    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await screen.findByText(strings.home.inProgress);
    expect(screen.getByRole('link', { name: strings.home.resumeWorkout })).toBeVisible();
  });

  it('does not re-read while the mount read is pending', async () => {
    const f = await renderBase();
    const snapshot = await f.store.workouts.current();
    const first = deferred<ActiveWorkout | null>();
    const c = countingWorkouts(f.store, () => first.promise);
    renderApp(c.store, f.clock, '/workout');
    await waitFor(() => expect(c.calls()).toBe(1));
    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await settle();
    expect(c.calls()).toBe(1);

    await act(async () => first.resolve(snapshot));
    expect(await screen.findByRole('timer', { name: W.restTimer })).toBeInTheDocument();
  });
});

describe('read ordering and failures', () => {
  it('ignores a pending visibility re-read once an intent has started', async () => {
    const user = userEvent.setup();
    setVisibility('visible');
    const f = await setup();
    await f.at(sec(0)).start();
    await f.at(sec(10)).openBlock(f.id('Push-up'));
    f.clock.set(sec(20));
    const ready = await f.store.workouts.current();
    const late = deferred<ActiveWorkout | null>();
    const c = countingWorkouts(f.store, (n) =>
      n === 2 ? late.promise : f.store.workouts.current(),
    );
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('button', { name: W.start });
    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(c.calls()).toBe(2);

    await user.click(screen.getByRole('button', { name: W.start }));
    await screen.findByRole('timer', { name: W.setTimer });
    await act(async () => late.resolve(ready));
    expect(screen.getByRole('timer', { name: W.setTimer })).toBeInTheDocument();
  });

  it('does not re-read while an intent is in flight, on visible or on the tick', async () => {
    const user = userEvent.setup();
    const f = await renderBase();
    const never = new Promise<ActiveWorkout>(() => {});
    const c = countingWorkouts(f.store, undefined, { startSet: () => never });
    renderApp(c.store, f.clock, '/workout');
    await user.click(await screen.findByRole('button', { name: W.start }));
    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await settle();
    expect(c.calls()).toBe(1);

    await tick(f, AUTO_CLOSE);
    await settle();
    expect(c.calls()).toBe(1);
  });

  it('keeps the one-shot tick flag when the skipped tick was blocked by an intent', async () => {
    const user = userEvent.setup();
    const f = await renderBase();
    const snapshot = await f.store.workouts.current();
    const intent = deferred<ActiveWorkout>();
    const c = countingWorkouts(f.store, undefined, { startSet: () => intent.promise });
    renderApp(c.store, f.clock, '/workout');
    await user.click(await screen.findByRole('button', { name: W.start }));
    await tick(f, AUTO_CLOSE);
    await settle();
    expect(c.calls()).toBe(1);

    await act(async () => intent.resolve(snapshot!));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: W.start })).not.toHaveAttribute('aria-disabled'),
    );
    await settle();
    await tick(f, AUTO_CLOSE + 250);
    await waitFor(() => expect(c.calls()).toBe(2));
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });

  it('keeps the screen when a visibility re-read fails and retries on the next trigger', async () => {
    const f = await renderBase();
    const c = countingWorkouts(f.store, (n) =>
      n === 2 ? Promise.reject(new Error('read failed')) : f.store.workouts.current(),
    );
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await waitFor(() => expect(c.calls()).toBe(2));
    await settle();
    expect(screen.getByRole('timer', { name: W.restTimer })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    const other = openStoreOn(f.name, f.clock);
    f.clock.set(sec(100));
    await other.workouts.finish();
    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });

  it('retries a failed tick re-read only after 5 s', async () => {
    const f = await renderBase();
    const c = countingWorkouts(f.store, (n) =>
      n === 2 ? Promise.reject(new Error('read failed')) : f.store.workouts.current(),
    );
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    await tick(f, AUTO_CLOSE);
    await waitFor(() => expect(c.calls()).toBe(2));
    await settle();
    expect(screen.getByRole('timer', { name: W.restTimer })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await tick(f, AUTO_CLOSE + 250);
    await tick(f, AUTO_CLOSE + 4_999);
    await settle();
    expect(c.calls()).toBe(2);

    await tick(f, AUTO_CLOSE + 5_000);
    await waitFor(() => expect(c.calls()).toBe(3));
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });

  it('measures the first retry from autoCloseAt when the first tick lands late', async () => {
    const f = await renderBase();
    const c = countingWorkouts(f.store, (n) =>
      n === 2 ? Promise.reject(new Error('read failed')) : f.store.workouts.current(),
    );
    renderApp(c.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    await tick(f, AUTO_CLOSE + 250);
    await waitFor(() => expect(c.calls()).toBe(2));
    await settle();

    await tick(f, AUTO_CLOSE + 4_999);
    await settle();
    expect(c.calls()).toBe(2);

    await tick(f, AUTO_CLOSE + 5_000);
    await waitFor(() => expect(c.calls()).toBe(3));
    await waitFor(() => expect(probe().textContent).toBe('/'));
  });

  it('never lets an older read overwrite a newer one', async () => {
    const f = await renderBase();
    const snapshot = await f.store.workouts.current();
    const late = deferred<ActiveWorkout | null>();
    const c = countingWorkouts(f.store, (n) =>
      n === 2 ? late.promise : f.store.workouts.current(),
    );
    renderApp(c.store, f.clock, '/');
    await screen.findByText(strings.home.inProgress);
    await tick(f, AUTO_CLOSE);
    await waitFor(() => expect(c.calls()).toBe(2));
    await settle();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(await screen.findByRole('button', { name: strings.home.startWorkout })).toBeVisible();

    await act(async () => {
      late.resolve(snapshot);
      await late.promise;
    });
    await settle();
    expect(screen.getByRole('button', { name: strings.home.startWorkout })).toBeVisible();
    expect(screen.queryByRole('link', { name: strings.home.resumeWorkout })).toBeNull();
  });
});

describe('header link on the tick', () => {
  it('disappears from the banner when the Workout auto-closes', async () => {
    const f = await renderBase();
    renderApp(f.store, f.clock, '/exercises');
    const banner = await screen.findByRole('banner');
    await within(banner).findByRole('link', { name: strings.header.workoutInProgress });

    await tick(f, AUTO_CLOSE);
    await waitFor(() =>
      expect(
        within(banner).queryByRole('link', { name: strings.header.workoutInProgress }),
      ).toBeNull(),
    );
  });
});
