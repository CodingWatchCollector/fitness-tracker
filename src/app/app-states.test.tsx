import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { openDataStore, type DataStore } from '../data';
import { strings } from '../strings';
import { rawOpenVersion } from '../test-utils/raw-idb';

function stubStore(overrides: {
  ensureSeeded: () => Promise<void>;
  list?: () => Promise<never[]>;
}): DataStore {
  return {
    ensureSeeded: overrides.ensureSeeded,
    exercises: {
      list: overrides.list ?? (() => Promise.resolve([])),
      get: () => Promise.resolve(undefined),
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
  });

  it('shows the error text when seeding rejects', async () => {
    render(<App store={stubStore({ ensureSeeded: () => Promise.reject(new Error('boom')) })} />);
    expect(await screen.findByText(strings.status.error)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: strings.appName })).toBeInTheDocument();
  });

  it('shows the error text on the list screen when the list query rejects', async () => {
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
    await expect(store.exercises.list()).rejects.toThrow();
    await user.click(screen.getByRole('button', { name: strings.status.reload }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
