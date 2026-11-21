import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderApp } from './render-app';
import { settle } from './settle';
import { closeFixtures, setup } from './workout-fixtures';

afterEach(() => {
  cleanup();
  closeFixtures();
  vi.restoreAllMocks();
});

it('resolves without a console error when no app was rendered', async () => {
  const error = vi.spyOn(console, 'error');
  await settle();
  expect(error).not.toHaveBeenCalled();
});

it('resolves without a console error after the app was unmounted', async () => {
  const f = await setup();
  renderApp(f.store, f.clock, '/exercises');
  await screen.findByLabelText('location');
  cleanup();
  const error = vi.spyOn(console, 'error');
  await settle();
  expect(error).not.toHaveBeenCalled();
});
