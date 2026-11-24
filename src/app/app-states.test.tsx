import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { openDataStore, type DataStore } from '../data';
import { strings } from '../strings';
import { rawOpenVersion } from '../test-utils/raw-idb';

const rejectUnused = () => Promise.reject(new Error('unused'));

function stubStore(overrides: {
  ensureSeeded: () => Promise<void>;
  list?: () => Promise<never[]>;
}): DataStore {
  return {
    ensureSeeded: overrides.ensureSeeded,
    exercises: {
      list: overrides.list ?? (() => Promise.resolve([])),
      get: () => Promise.resolve(undefined),
      recent: () => Promise.resolve([]),
    },
    workouts: {
      current: () => Promise.resolve(null),
      start: rejectUnused,
      openBlock: rejectUnused,
      setPlannedRest: rejectUnused,
      startSet: rejectUnused,
      doneSet: rejectUnused,
      saveReps: rejectUnused,
      endBlock: rejectUnused,
      finish: rejectUnused,
    },
    equipment: {
      list: () => Promise.resolve([]),
      add: rejectUnused,
      update: rejectUnused,
      remove: rejectUnused,
    },
    onVersionChange: () => () => undefined,
    close: () => undefined,
  };
}

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('store states', () => {
  it('shows loading while seeding is pending', () => {
    render(<App store={stubStore({ ensureSeeded: () => new Promise(() => undefined) })} />);
    expect(screen.getByText(strings.status.loading)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: strings.appName })).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link'),
    ).toHaveAttribute('href', '/');
  });

  it('shows the error text when seeding rejects', async () => {
    render(<App store={stubStore({ ensureSeeded: () => Promise.reject(new Error('boom')) })} />);
    expect(await screen.findByText(strings.status.error)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: strings.appName })).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link'),
    ).toHaveAttribute('href', '/');
  });

  it('shows the error text on the list screen when the list query rejects', async () => {
    window.history.pushState({}, '', '/exercises');
    render(
      <App
        store={stubStore({
          ensureSeeded: () => Promise.resolve(),
          list: () => Promise.reject(new Error('boom')),
        })}
      />,
    );
    expect(await screen.findByText(strings.status.error)).toBeInTheDocument();
  });

  it('asks for a reload after another connection upgrades the database', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/exercises');
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
    const name = crypto.randomUUID();
    const store = openDataStore({ name });
    render(<App store={store} />);
    await screen.findByRole('list', { name: strings.exerciseList.title });

    await rawOpenVersion(name, 20);

    expect(await screen.findByText(strings.status.reloadNeeded)).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link'),
    ).toHaveAttribute('href', '/');
    await expect(store.exercises.list()).rejects.toThrow();
    await user.click(screen.getByRole('button', { name: strings.status.reload }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  describe('Equipment route', () => {
    function countingStub(
      ensureSeeded: () => Promise<void>,
      onVersionChange?: DataStore['onVersionChange'],
    ) {
      let calls = 0;
      const store = stubStore({ ensureSeeded });
      store.equipment.list = () => {
        calls += 1;
        return Promise.resolve([]);
      };
      if (onVersionChange) store.onVersionChange = onVersionChange;
      return { store, calls: () => calls };
    }
    const titleLink = () =>
      within(screen.getByRole('heading', { name: strings.appName })).getByRole('link');

    it('shows loading with the header while seeding is pending', () => {
      window.history.pushState({}, '', '/equipment');
      const stub = countingStub(() => new Promise(() => undefined));
      render(<App store={stub.store} />);
      expect(screen.getByRole('main')).toHaveTextContent(/^Loading\.\.\.$/);
      expect(screen.getByText(strings.status.loading)).toBeInTheDocument();
      expect(titleLink()).toHaveAttribute('href', '/');
      expect(screen.queryByRole('list', { name: strings.equipment.listLabel })).toBeNull();
      expect(stub.calls()).toBe(0);
    });

    it('shows the error with the header after a failed seeding', async () => {
      window.history.pushState({}, '', '/equipment');
      const stub = countingStub(() => Promise.reject(new Error('boom')));
      render(<App store={stub.store} />);
      expect(await screen.findByText(strings.status.error)).toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent(strings.status.error);
      expect(titleLink()).toHaveAttribute('href', '/');
      expect(stub.calls()).toBe(0);
    });

    it('asks for a reload when the version change fires before seeding settles', async () => {
      window.history.pushState({}, '', '/equipment');
      let fire!: () => void;
      let settle!: () => void;
      const stub = countingStub(
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
      expect(screen.getByRole('button', { name: strings.status.reload })).toBeInTheDocument();
      expect(titleLink()).toHaveAttribute('href', '/');
      expect(screen.queryByRole('heading', { name: strings.equipment.title })).toBeNull();
      expect(stub.calls()).toBe(0);
    });
  });
});
