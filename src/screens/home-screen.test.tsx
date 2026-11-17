import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkoutStateError } from '../data';
import { strings } from '../strings';
import { renderApp, withWorkouts, deferred } from '../test-utils/render-app';
import { T, closeFixtures, setup } from '../test-utils/workout-fixtures';

afterEach(closeFixtures);

const probe = () => screen.getByLabelText('location');

describe('Home', () => {
  it('offers Start Workout and the Exercises link without an active Workout', async () => {
    const user = userEvent.setup();
    const f = await setup();
    renderApp(f.store, f.clock, '/');

    expect(
      await screen.findByRole('button', { name: strings.home.startWorkout }),
    ).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('link', { name: strings.home.exercises })).toHaveAttribute(
      'href',
      '/exercises',
    );
    await user.click(screen.getByRole('button', { name: strings.home.startWorkout }));
    await screen.findByRole('list', { name: strings.picker.all });
    expect(probe()).toHaveTextContent('/workout');
  });

  it('offers Resume Workout while a Workout is active', async () => {
    const f = await setup();
    await f.at(T).start();
    renderApp(f.store, f.clock, '/');

    expect(await screen.findByText(strings.home.inProgress)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: strings.home.resumeWorkout })).toHaveAttribute(
      'href',
      '/workout',
    );
    expect(screen.queryByRole('button', { name: strings.home.startWorkout })).toBeNull();
  });

  it('goes to the Workout when another tab already started one', async () => {
    const user = userEvent.setup();
    const f = await setup();
    renderApp(f.store, f.clock, '/');
    await screen.findByRole('button', { name: strings.home.startWorkout });

    await f.store.workouts.start();
    await user.click(screen.getByRole('button', { name: strings.home.startWorkout }));

    expect(await screen.findByRole('list', { name: strings.picker.all })).toBeInTheDocument();
    expect(probe()).toHaveTextContent('/workout');
  });

  it('shows an alert and stays on Home when start fails for another reason', async () => {
    const user = userEvent.setup();
    const f = await setup();
    const store = withWorkouts(f.store, { start: () => Promise.reject(new Error('boom')) });
    renderApp(store, f.clock, '/');

    await user.click(await screen.findByRole('button', { name: strings.home.startWorkout }));

    expect(await screen.findByRole('alert')).toHaveTextContent(strings.home.startFailed);
    expect(probe().textContent).toBe('/');
  });

  it('is not fooled by a WorkoutStateError of another code', async () => {
    const user = userEvent.setup();
    const f = await setup();
    const store = withWorkouts(f.store, {
      start: () => Promise.reject(new WorkoutStateError('invalid-transition')),
    });
    renderApp(store, f.clock, '/');
    await user.click(await screen.findByRole('button', { name: strings.home.startWorkout }));
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.home.startFailed);
    expect(probe().textContent).toBe('/');
  });

  it('disables Start Workout until start resolves', async () => {
    const user = userEvent.setup();
    const f = await setup();
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      start: async () => {
        await gate.promise;
        return f.store.workouts.start();
      },
    });
    renderApp(store, f.clock, '/');

    await user.click(await screen.findByRole('button', { name: strings.home.startWorkout }));
    const start = screen.getByRole('button', { name: strings.home.startWorkout });
    expect(start).toHaveAttribute('aria-disabled', 'true');
    expect(start).not.toHaveAttribute('disabled');
    await act(async () => gate.resolve());
    expect(await screen.findByRole('list', { name: strings.picker.all })).toBeInTheDocument();
  });
});

describe('routes', () => {
  it('sends /workout back to Home without an active Workout', async () => {
    const f = await setup();
    renderApp(f.store, f.clock, '/workout');
    expect(
      await screen.findByRole('button', { name: strings.home.startWorkout }),
    ).toBeInTheDocument();
    expect(probe().textContent).toBe('/');
  });

  it('shows the 15 Exercises at /exercises', async () => {
    const f = await setup();
    renderApp(f.store, f.clock, '/exercises');
    const list = await screen.findByRole('list', { name: strings.exerciseList.title });
    expect(within(list).getAllByRole('listitem')).toHaveLength(15);
  });
});
