import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../data';
import { strings } from '../strings';
import { rawExercises } from '../test-utils/raw-idb';
import { deferred, renderApp, withWorkouts } from '../test-utils/render-app';
import { testClock } from '../test-utils/test-clock';
import {
  H3,
  T,
  baseResting,
  closeFixtures,
  openStoreOn,
  sec,
  setup,
  type Fixture,
} from '../test-utils/workout-fixtures';

afterEach(closeFixtures);

const W = strings.workout;
const probe = () => screen.getByLabelText('location');
const button = (name: string) => screen.getByRole('button', { name });
const output = (name: string) => screen.getByRole('status', { name });
const timer = (name: string) => screen.getByRole('timer', { name });

const ORDER = [
  'Back lever',
  'Calf raises',
  'Dips',
  'Face pull',
  'Full body warm-up',
  'L-sit compression',
  'Pike push-up',
  'Pike push-up (elbows out)',
  'Pistol squat',
  'Pull-up',
  'Push-up',
  'Ring rows',
  'RTO hold',
  'Squat',
  'Straight leg pull-up (L-sit pull-up)',
];
const TIME_BASED = ['Back lever', 'Full body warm-up', 'L-sit compression', 'RTO hold'];

async function setFavorite(f: Fixture, exerciseName: string) {
  const exercise: Exercise = f.exercise(exerciseName);
  await rawExercises.put(f.name, { ...exercise, favorite: true });
}

async function finishedPullUpWorkout(f: Fixture) {
  await f.at(T).start();
  const opened = await f.at(sec(1)).openBlock(f.id('Pull-up'));
  const blockId = opened.blocks[0]!.block.id;
  const running = await f.at(sec(2)).startSet(blockId);
  const setId = running.blocks[0]!.sets[0]!.id;
  await f.at(sec(3)).doneSet(setId);
  await f.at(sec(4)).saveReps(setId, 5);
  await f.at(sec(5)).finish();
}

async function openPushUp(f: Fixture, at = sec(10)) {
  const opened = await f.at(at).openBlock(f.id('Push-up'));
  return opened.blocks[0]!.block.id;
}

describe('exercise picker', () => {
  it('lists all Exercises, disables time-based ones and filters by search', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    renderApp(f.store, f.clock, '/workout');

    const all = await screen.findByRole('list', { name: strings.picker.all });
    const buttons = within(all).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(ORDER);
    for (const b of buttons) {
      if (TIME_BASED.includes(b.textContent!)) {
        expect(b).toHaveAttribute('aria-disabled', 'true');
        expect(b).not.toHaveAttribute('disabled');
        expect(b).toHaveAccessibleDescription(strings.picker.timeBasedLater);
      } else {
        expect(b).not.toHaveAttribute('aria-disabled');
      }
    }
    expect(screen.queryByRole('list', { name: strings.picker.favorites })).toBeNull();
    expect(screen.queryByRole('list', { name: strings.picker.recent })).toBeNull();

    await user.type(screen.getByRole('searchbox', { name: strings.picker.search }), '  PUSH ');
    expect(
      within(screen.getByRole('list', { name: strings.picker.all }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Pike push-up', 'Pike push-up (elbows out)', 'Push-up']);

    await user.clear(screen.getByRole('searchbox', { name: strings.picker.search }));
    await user.type(screen.getByRole('searchbox', { name: strings.picker.search }), 'zzz');
    expect(screen.getByText(strings.picker.noMatches)).toBeInTheDocument();
  });

  it('lists Favorites by name', async () => {
    const f = await setup();
    await setFavorite(f, 'Squat');
    await setFavorite(f, 'Dips');
    await f.at(T).start();
    renderApp(f.store, f.clock, '/workout');

    const favorites = await screen.findByRole('list', { name: strings.picker.favorites });
    expect(
      within(favorites)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Dips', 'Squat']);
  });

  it('lists Recent from earlier Workouts and drops Exercises already in this one', async () => {
    const f = await setup();
    await finishedPullUpWorkout(f);
    await f.at(sec(100)).start();
    const view = renderApp(f.store, f.clock, '/workout');

    const recent = await screen.findByRole('list', { name: strings.picker.recent });
    expect(
      within(recent)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Pull-up']);
    view.unmount();

    const opened = await f.at(sec(110)).openBlock(f.id('Pull-up'));
    const blockId = opened.blocks[0]!.block.id;
    const running = await f.at(sec(120)).startSet(blockId);
    const setId = running.blocks[0]!.sets[0]!.id;
    await f.at(sec(130)).doneSet(setId);
    await f.at(sec(140)).saveReps(setId, 6);
    await f.at(sec(150)).endBlock(blockId);
    renderApp(f.store, f.clock, '/workout');

    await screen.findByRole('list', { name: strings.picker.all });
    expect(screen.queryByRole('list', { name: strings.picker.recent })).toBeNull();
  });

  it('hides Favorites and Recent while searching and opens the chosen Exercise', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await setFavorite(f, 'Squat');
    await setFavorite(f, 'Dips');
    await finishedPullUpWorkout(f);
    await f.at(sec(100)).start();
    renderApp(f.store, f.clock, '/workout');

    await screen.findByRole('list', { name: strings.picker.favorites });
    expect(screen.getByRole('list', { name: strings.picker.recent })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: strings.picker.search }), 'pu');
    expect(screen.queryByRole('list', { name: strings.picker.favorites })).toBeNull();
    expect(screen.queryByRole('list', { name: strings.picker.recent })).toBeNull();
    const all = screen.getByRole('list', { name: strings.picker.all });

    await user.click(within(all).getByRole('button', { name: 'Push-up' }));
    expect(await screen.findByRole('heading', { name: 'Push-up' })).toBeInTheDocument();
    expect(output(W.plannedRest)).toHaveTextContent('1:30');
  });
});

describe('the Set loop through the UI', () => {
  it('runs a Set from Home to the saved Reps', async () => {
    const user = userEvent.setup();
    const f = await setup();
    renderApp(f.store, f.clock, '/');

    f.clock.set(T);
    await user.click(await screen.findByRole('button', { name: strings.home.startWorkout }));
    f.clock.set(sec(10));
    await user.click(await screen.findByRole('button', { name: 'Push-up' }));
    await user.click(await screen.findByRole('button', { name: W.restLess }));
    await waitFor(() => expect(output(W.plannedRest)).toHaveTextContent('1:15'));
    expect((await f.dump()).blocks[0]!.plannedRestSec).toBe(75);

    f.clock.set(sec(20));
    await user.click(button(W.start));
    f.clock.set(sec(50));
    await user.click(await screen.findByRole('button', { name: W.done }));
    expect(await screen.findByRole('status', { name: W.reps })).toHaveTextContent('10');
    await user.click(button(W.repsMore));
    await user.click(button(W.repsMore));
    expect(output(W.reps)).toHaveTextContent('12');
    await user.click(button(W.save));

    expect(await screen.findByText(W.setLine(1, 12))).toBeInTheDocument();
    expect(timer(W.restTimer)).toBeInTheDocument();
    expect((await f.dump()).sets[0]!.reps).toBe(12);
  });

  it('ends a block while resting and drops an empty block from ready', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await baseResting(f);
    renderApp(f.store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.endBlock.resting }));
    await screen.findByRole('list', { name: strings.picker.all });

    await user.click(screen.getByRole('button', { name: 'Squat' }));
    await user.click(await screen.findByRole('button', { name: W.endBlock.ready }));
    await screen.findByRole('list', { name: strings.picker.all });
    const dump = await f.dump();
    const squat = dump.blocks.find((b) => b.exerciseId === f.id('Squat'))!;
    expect(squat.deletedAt).not.toBeNull();
  });

  it('confirms Finish, warns about an unsaved Set and keeps the Set on cancel', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(20)).startSet(blockId);
    renderApp(f.store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.finish }));
    const dialog = screen.getByRole('dialog', { name: W.finishDialog.title });
    expect(within(dialog).getByText(W.finishDialog.unsaved)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: W.finishDialog.cancel }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(timer(W.setTimer)).toBeInTheDocument();
  });

  it('opens the Finish dialog as a modal, focuses cancel and returns focus on cancel and on dismiss', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(20)).startSet(blockId);
    renderApp(f.store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.finish }));
    const dialog = screen.getByRole('dialog', { name: W.finishDialog.title });
    expect(within(dialog).getByRole('button', { name: W.finishDialog.cancel })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: W.finishDialog.cancel }));
    expect(button(W.finish)).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(button(W.finish));
    const reopened = screen.getByRole('dialog', { name: W.finishDialog.title });
    act(() => (reopened as HTMLDialogElement).close());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button(W.finish)).toHaveFocus();
  });

  it('warns in reps-pending and not while resting, then finishes to Home', async () => {
    const user = userEvent.setup();
    const f = await setup();
    const { blockId } = await baseResting(f);
    await f.at(sec(130)).startSet(blockId);
    const running = await f.store.workouts.current();
    const set2 = running!.blocks[0]!.sets[1]!.id;
    await f.at(sec(160)).doneSet(set2);
    renderApp(f.store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.finish }));
    expect(screen.getByText(W.finishDialog.unsaved)).toBeInTheDocument();
    await user.click(button(W.finishDialog.cancel));
    await user.click(button(W.save));
    await screen.findByText(W.setLine(2, 12));

    await user.click(button(W.finish));
    expect(screen.queryByText(W.finishDialog.unsaved)).toBeNull();
    f.clock.set(sec(300));
    await user.click(button(W.finishDialog.confirm));

    expect(
      await screen.findByRole('button', { name: strings.home.startWorkout }),
    ).toBeInTheDocument();
    expect(probe().textContent).toBe('/');
    expect((await f.dump()).workouts[0]!.endedAt).not.toBeNull();
  });

  it('disables Start, End block and Finish while startSet is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    await openPushUp(f);
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      startSet: async (id) => {
        await gate.promise;
        return f.store.workouts.startSet(id);
      },
    });
    renderApp(store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.start }));
    expect(button(W.start)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.start)).not.toHaveAttribute('disabled');
    expect(button(W.endBlock.ready)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.endBlock.ready)).not.toHaveAttribute('disabled');
    expect(button(W.finish)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.finish)).not.toHaveAttribute('disabled');
    expect(button(W.restLess)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.restLess)).not.toHaveAttribute('disabled');
    expect(button(W.restMore)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.restMore)).not.toHaveAttribute('disabled');
    const finish = button(W.finish);
    await act(async () => gate.resolve());
    expect(await screen.findByRole('timer', { name: W.setTimer })).toBeInTheDocument();
    expect(finish).not.toHaveAttribute('aria-disabled');
  });

  it('makes Done unavailable while doneSet is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(20)).startSet(blockId);
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      doneSet: async (id) => {
        await gate.promise;
        return f.store.workouts.doneSet(id);
      },
    });
    renderApp(store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.done }));
    expect(button(W.done)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.done)).not.toHaveAttribute('disabled');
    await act(async () => gate.resolve());
    expect(await screen.findByRole('status', { name: W.reps })).toBeInTheDocument();
  });

  it('makes Save unavailable while saveReps is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    const running = await f.at(sec(20)).startSet(blockId);
    await f.at(sec(30)).doneSet(running.blocks[0]!.sets[0]!.id);
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      saveReps: async (id, reps) => {
        await gate.promise;
        return f.store.workouts.saveReps(id, reps);
      },
    });
    renderApp(store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.save }));
    expect(button(W.save)).toHaveAttribute('aria-disabled', 'true');
    expect(button(W.save)).not.toHaveAttribute('disabled');
    await act(async () => gate.resolve());
    expect(await screen.findByRole('timer', { name: W.restTimer })).toBeInTheDocument();
  });

  it('makes Start and End block unavailable in the rest step while startSet is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await baseResting(f);
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      startSet: async (id) => {
        await gate.promise;
        return f.store.workouts.startSet(id);
      },
    });
    renderApp(store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.start }));
    for (const name of [W.start, W.endBlock.resting]) {
      expect(button(name)).toHaveAttribute('aria-disabled', 'true');
      expect(button(name)).not.toHaveAttribute('disabled');
    }
    await act(async () => gate.resolve());
    expect(await screen.findByRole('timer', { name: W.setTimer })).toBeInTheDocument();
  });

  it('makes rep-based Exercise buttons unavailable while openBlock is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      openBlock: async (id) => {
        await gate.promise;
        return f.store.workouts.openBlock(id);
      },
    });
    renderApp(store, f.clock, '/workout');

    const all = await screen.findByRole('list', { name: strings.picker.all });
    await user.click(within(all).getByRole('button', { name: 'Push-up' }));
    for (const b of within(all).getAllByRole('button')) {
      expect(b).toHaveAttribute('aria-disabled', 'true');
      expect(b).not.toHaveAttribute('disabled');
    }
    await act(async () => gate.resolve());
    expect(await screen.findByRole('heading', { name: 'Push-up' })).toBeInTheDocument();
  });

  it('keeps focus on planned-rest more while setPlannedRest is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(11)).setPlannedRest(blockId, 60);
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      setPlannedRest: async (id, value) => {
        await gate.promise;
        return f.store.workouts.setPlannedRest(id, value);
      },
    });
    renderApp(store, f.clock, '/workout');
    await screen.findByText('1:00');

    button(W.restMore).focus();
    await user.keyboard('{Enter}');
    expect(button(W.restMore)).toHaveFocus();
    expect(button(W.restMore)).toHaveAttribute('aria-disabled', 'true');
    await act(async () => gate.resolve());
    await screen.findByText('1:15');
    expect(output(W.plannedRest)).toHaveTextContent('1:15');
    expect(button(W.restMore)).toHaveFocus();
    expect(button(W.restMore)).not.toHaveAttribute('aria-disabled');
  });

  it('ignores a click on a time-based Exercise button', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const openBlock = vi.fn(f.store.workouts.openBlock);
    renderApp(withWorkouts(f.store, { openBlock }), f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: 'Back lever' }));
    expect(openBlock).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox', { name: strings.picker.search })).toBeInTheDocument();
  });

  it('does not open the Finish dialog while an intent is pending', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    await openPushUp(f);
    const gate = deferred<void>();
    const store = withWorkouts(f.store, {
      startSet: async (id) => {
        await gate.promise;
        return f.store.workouts.startSet(id);
      },
    });
    renderApp(store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.start }));
    await user.click(button(W.finish));
    expect(screen.queryByRole('dialog', { name: W.finishDialog.title })).toBeNull();
    expect(document.querySelector('dialog[open]')).toBeNull();
    await act(async () => gate.resolve());
    await screen.findByRole('timer', { name: W.setTimer });
  });

  it('shows an alert and keeps the stored step when doneSet fails', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(20)).startSet(blockId);
    const store = withWorkouts(f.store, { doneSet: () => Promise.reject(new Error('boom')) });
    renderApp(store, f.clock, '/workout');

    await user.click(await screen.findByRole('button', { name: W.done }));

    expect(await screen.findByRole('alert')).toHaveTextContent(W.actionFailed);
    expect(timer(W.setTimer)).toBeInTheDocument();
  });

  it('returns to Home when the Workout was auto-closed before the tap', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await baseResting(f);
    renderApp(f.store, f.clock, '/workout');
    await screen.findByRole('button', { name: W.start });

    f.clock.set(sec(55) + H3);
    await user.click(button(W.start));

    expect(
      await screen.findByRole('button', { name: strings.home.startWorkout }),
    ).toBeInTheDocument();
    expect(probe().textContent).toBe('/');
    expect((await f.dump()).workouts[0]!.autoClosed).toBe(true);
  });
});

describe('steppers', () => {
  it.each([
    [0, W.restLess, null],
    [600, W.restMore, null],
    [700, W.restMore, null],
  ])('disables the end of the range at %i s', async (sec0, name) => {
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(11)).setPlannedRest(blockId, sec0);
    renderApp(f.store, f.clock, '/workout');
    const stepper = await screen.findByRole('button', { name });
    expect(stepper).toHaveAttribute('aria-disabled', 'true');
    expect(stepper).not.toHaveAttribute('disabled');
  });

  it.each([
    [10, W.restLess, '0:00'],
    [595, W.restMore, '10:00'],
    [700, W.restLess, '11:25'],
  ])('steps planned rest from %i s with %s', async (from, name, shown) => {
    const user = userEvent.setup();
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    await f.at(sec(11)).setPlannedRest(blockId, from);
    renderApp(f.store, f.clock, '/workout');
    await user.click(await screen.findByRole('button', { name }));
    await screen.findByText(shown);
    expect(output(W.plannedRest)).toHaveTextContent(shown);
  });

  it.each([
    [0, W.repsLess],
    [999, W.repsMore],
  ])('disables the Reps stepper at %i', async (reps, name) => {
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    const first = await f.at(sec(20)).startSet(blockId);
    const firstId = first.blocks[0]!.sets[0]!.id;
    await f.at(sec(30)).doneSet(firstId);
    await f.at(sec(31)).saveReps(firstId, reps);
    const second = await f.at(sec(40)).startSet(blockId);
    await f.at(sec(50)).doneSet(second.blocks[0]!.sets[1]!.id);
    renderApp(f.store, f.clock, '/workout');

    const stepper = await screen.findByRole('button', { name });
    expect(stepper).toHaveAttribute('aria-disabled', 'true');
    expect(stepper).not.toHaveAttribute('disabled');
    expect(output(W.reps)).toHaveTextContent(String(reps));
  });
});

describe('timers', () => {
  const tick = (f: Fixture, ms: number) =>
    act(() => {
      f.clock.set(ms);
      f.clock.tick();
    });

  it('shows the overall timer', async () => {
    const f = await setup();
    await f.at(T).start();
    renderApp(f.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.overallTimer });

    tick(f, sec(754));
    expect(timer(W.overallTimer)).toHaveTextContent('12:34');
    tick(f, sec(3723));
    expect(timer(W.overallTimer)).toHaveTextContent('1:02:03');
  });

  it('shows the running Set time', async () => {
    const f = await setup();
    const { blockId } = await baseResting(f);
    await f.at(sec(100)).startSet(blockId);
    renderApp(f.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.setTimer });
    tick(f, sec(145));
    expect(timer(W.setTimer)).toHaveTextContent('0:45');
  });

  it('counts the rest down and then up', async () => {
    const f = await setup();
    await f.at(T).start();
    const blockId = await openPushUp(f);
    const running = await f.at(sec(100)).startSet(blockId);
    await f.at(sec(200)).doneSet(running.blocks[0]!.sets[0]!.id);
    renderApp(f.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });

    tick(f, sec(200) + 1200);
    expect(timer(W.restTimer)).toHaveTextContent('1:29');
    expect(screen.getByText(W.restPhase.countdown)).toBeInTheDocument();
    tick(f, sec(290));
    expect(timer(W.restTimer)).toHaveTextContent('+0:00');
    expect(screen.getByText(W.restPhase.overtime)).toBeInTheDocument();
    tick(f, sec(295));
    expect(timer(W.restTimer)).toHaveTextContent('+0:05');
  });

  it('switches to overtime at once when planned rest drops below the elapsed rest', async () => {
    const user = userEvent.setup();
    const f = await setup();
    await baseResting(f);
    f.clock.set(sec(130));
    renderApp(f.store, f.clock, '/workout');
    await screen.findByRole('timer', { name: W.restTimer });
    expect(timer(W.restTimer)).toHaveTextContent('0:10');

    await user.click(button(W.restLess));

    await waitFor(() => expect(timer(W.restTimer)).toHaveTextContent('+0:05'));
    expect(screen.getByText(W.restPhase.overtime)).toBeInTheDocument();
  });
});

describe('resume after a reload', () => {
  type Stage = 'ready' | 'set-running' | 'reps-pending' | 'resting';

  async function drive(f: Fixture, stage: Stage) {
    await f.at(T).start();
    const blockId = await openPushUp(f);
    if (stage === 'ready') return f.store.workouts.current();
    const running = await f.at(sec(20)).startSet(blockId);
    const setId = running.blocks[0]!.sets[0]!.id;
    if (stage === 'set-running') return running;
    const done = await f.at(sec(50)).doneSet(setId);
    if (stage === 'reps-pending') return done;
    return f.at(sec(55)).saveReps(setId, 12);
  }

  const expectations: Record<Stage, () => void> = {
    'ready': () => {
      expect(screen.getByRole('heading', { name: 'Push-up' })).toBeInTheDocument();
      expect(output(W.plannedRest)).toHaveTextContent('1:30');
    },
    'set-running': () => expect(timer(W.setTimer)).toHaveTextContent('1:00'),
    'reps-pending': () => {
      expect(output(W.reps)).toHaveTextContent('10');
      expect(timer(W.restTimer)).toHaveTextContent('1:00');
      expect(button(W.restLess)).toBeInTheDocument();
      expect(button(W.restMore)).toBeInTheDocument();
      expect(output(W.plannedRest)).toHaveTextContent('1:30');
    },
    'resting': () => {
      expect(timer(W.restTimer)).toHaveTextContent('1:00');
      expect(screen.getByText(W.restPhase.countdown)).toBeInTheDocument();
      expect(screen.getByText(W.setLine(1, 12))).toBeInTheDocument();
    },
  };

  it.each(['ready', 'set-running', 'reps-pending', 'resting'] as const)(
    'restores the %s step exactly',
    async (stage) => {
      const user = userEvent.setup();
      const f = await setup();
      const last = await drive(f, stage);

      if (stage === 'reps-pending') {
        f.clock.set(sec(60));
        const before = renderApp(f.store, f.clock, '/workout');
        await user.click(await screen.findByRole('button', { name: W.repsMore }));
        await user.click(button(W.repsMore));
        await user.click(button(W.repsMore));
        expect(output(W.reps)).toHaveTextContent('13');
        before.unmount();
        cleanup();
      }
      f.store.close();

      const clockB = testClock(sec(80));
      const storeB = openStoreOn(f.name, clockB);
      expect(await storeB.workouts.current()).toEqual(last);
      renderApp(storeB, clockB, '/workout');

      await screen.findByRole('timer', { name: W.overallTimer });
      expectations[stage]();
      expect(timer(W.overallTimer)).toHaveTextContent('1:20');
    },
  );
});
