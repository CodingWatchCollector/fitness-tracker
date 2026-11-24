import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import type { DataStore } from '../data';
import { strings } from '../strings';
import { countingWorkouts, renderApp } from '../test-utils/render-app';
import { rawOpenVersion } from '../test-utils/raw-idb';
import { resetVisibility, setVisibility } from '../test-utils/visibility';
import { H3, T, closeFixtures, setup } from '../test-utils/workout-fixtures';

const probe = () => screen.getByLabelText('location');
const banner = () => screen.getByRole('banner');
const workoutLink = () =>
  within(banner()).queryByRole('link', { name: strings.header.workoutInProgress });

afterEach(() => {
  cleanup();
  closeFixtures();
  resetVisibility();
  window.history.pushState({}, '', '/');
});

function stubStore(
  ensureSeeded: () => Promise<void>,
  onVersionChange: DataStore['onVersionChange'] = () => () => undefined,
) {
  let current = 0;
  const unused = () => Promise.reject(new Error('unused'));
  const store: DataStore = {
    ensureSeeded,
    exercises: {
      list: () => Promise.resolve([]),
      get: () => Promise.resolve(undefined),
      recent: () => Promise.resolve([]),
    },
    workouts: {
      current: () => {
        current += 1;
        return Promise.resolve(null);
      },
      start: unused,
      openBlock: unused,
      setPlannedRest: unused,
      startSet: unused,
      doneSet: unused,
      saveReps: unused,
      endBlock: unused,
      finish: unused,
    },
    equipment: { list: () => Promise.resolve([]), add: unused, update: unused, remove: unused },
    onVersionChange,
    close: () => undefined,
  };
  return { store, calls: () => current };
}

describe('header string', () => {
  it('reads Workout in progress', () => {
    expect(strings.header.workoutInProgress).toBe('Workout in progress');
  });
});

describe('header Workout link on Exercise screens', () => {
  it('shows on the list and the detail screen and leads back to the Workout', async () => {
    const user = userEvent.setup();
    setVisibility('visible');
    const f = await setup();
    await f.at(T).start();

    renderApp(f.store, f.clock, '/exercises');
    await screen.findByRole('list', { name: strings.exerciseList.title });
    expect(
      await within(banner()).findByRole('link', { name: strings.header.workoutInProgress }),
    ).toHaveAttribute('href', '/workout');
    cleanup();

    renderApp(f.store, f.clock, `/exercises/${f.id('Push-up')}`);
    await screen.findByRole('heading', { name: 'Push-up' });
    const link = await within(banner()).findByRole('link', {
      name: strings.header.workoutInProgress,
    });
    await user.click(link);
    expect(probe().textContent).toBe('/workout');
    expect(workoutLink()).toBeNull();
  });

  it('is absent on Home', async () => {
    setVisibility('visible');
    const f = await setup();
    await f.at(T).start();
    renderApp(f.store, f.clock, '/');
    await screen.findByText(strings.home.inProgress);
    expect(workoutLink()).toBeNull();
  });

  it('is absent without an active Workout after one read', async () => {
    setVisibility('visible');
    const f = await setup();
    const c = countingWorkouts(f.store);
    renderApp(c.store, f.clock, '/exercises');
    await screen.findByRole('list', { name: strings.exerciseList.title });
    await waitFor(() => expect(c.calls()).toBe(1));
    await act(async () => {});
    expect(workoutLink()).toBeNull();
  });

  it('keeps the list when the read fails, without an error or alert', async () => {
    setVisibility('visible');
    const f = await setup();
    await f.at(T).start();
    const c = countingWorkouts(f.store, () => Promise.reject(new Error('read failed')));
    renderApp(c.store, f.clock, '/exercises');
    await screen.findByRole('list', { name: strings.exerciseList.title });
    await waitFor(() => expect(c.calls()).toBe(1));
    await act(async () => {});
    expect(workoutLink()).toBeNull();
    expect(within(banner()).queryByText(strings.status.error)).toBeNull();
    expect(within(screen.getByRole('main')).queryByText(strings.status.error)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('header in non-ready states', () => {
  it('shows the title link and no Workout link while loading, without reading', async () => {
    window.history.pushState({}, '', '/exercises');
    const stub = stubStore(() => new Promise(() => undefined));
    render(<App store={stub.store} />);
    expect(screen.getByText(strings.status.loading)).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link'),
    ).toHaveAttribute('href', '/');
    expect(workoutLink()).toBeNull();
    expect(stub.calls()).toBe(0);
  });

  it('shows the title link and no Workout link after a failed seeding', async () => {
    window.history.pushState({}, '', '/exercises');
    const stub = stubStore(() => Promise.reject(new Error('boom')));
    render(<App store={stub.store} />);
    expect(await screen.findByText(strings.status.error)).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link'),
    ).toHaveAttribute('href', '/');
    expect(workoutLink()).toBeNull();
    expect(stub.calls()).toBe(0);
  });

  it('shows reload-needed when the version change fires before seeding settles', async () => {
    window.history.pushState({}, '', '/exercises');
    let fire!: () => void;
    let settle!: () => void;
    const stub = stubStore(
      () => new Promise<void>((resolve) => (settle = resolve)),
      (cb) => {
        fire = cb;
        return () => undefined;
      },
    );
    render(<App store={stub.store} />);
    act(() => fire());
    await act(async () => settle());
    expect(await screen.findByText(strings.status.reloadNeeded)).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link'),
    ).toHaveAttribute('href', '/');
    expect(workoutLink()).toBeNull();
    expect(stub.calls()).toBe(0);
  });

  it('drops the link and stops reading when reload-needed shows after ready', async () => {
    setVisibility('visible');
    window.history.pushState({}, '', '/exercises');
    const f = await setup();
    await f.at(T).start();
    const c = countingWorkouts(f.store);
    render(<App store={c.store} clock={f.clock} />);
    await within(banner()).findByRole('link', { name: strings.header.workoutInProgress });

    await rawOpenVersion(f.name, 20);
    expect(await screen.findByText(strings.status.reloadNeeded)).toBeInTheDocument();
    expect(workoutLink()).toBeNull();

    const before = c.calls();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await act(async () => {
      f.clock.set(T + H3);
      f.clock.tick();
    });
    expect(c.calls()).toBe(before);
  });
});
