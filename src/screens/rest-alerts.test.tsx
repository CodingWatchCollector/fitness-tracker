import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { strings } from '../strings';
import { recordingAlerts } from '../test-utils/fake-ports';
import { renderApp } from '../test-utils/render-app';
import { settle } from '../test-utils/settle';
import { resetVisibility, setVisibility } from '../test-utils/visibility';
import {
  T,
  baseResting,
  closeFixtures,
  openStoreOn,
  sec,
  setup,
  tick,
} from '../test-utils/workout-fixtures';

const W = strings.workout;
const flash = () => document.querySelector('.rest-flash');
const restTimer = () => screen.findByRole('timer', { name: W.restTimer });
const plannedRest = () => screen.getByRole('status', { name: W.plannedRest });

afterEach(() => {
  closeFixtures();
  resetVisibility();
});

async function renderBase(at = 60, route = '/workout') {
  setVisibility('visible');
  const f = await setup();
  await baseResting(f);
  const rec = recordingAlerts();
  f.clock.set(sec(at));
  renderApp(f.store, f.clock, route, { alerts: rec.alerts });
  return { f, rec };
}

async function renderOnStoreB(at: number) {
  setVisibility('visible');
  const f = await setup();
  await baseResting(f);
  const rec = recordingAlerts();
  f.clock.set(sec(at));
  renderApp(openStoreOn(f.name, f.clock), f.clock, '/workout', { alerts: rec.alerts });
  return { f, rec };
}

describe('audio unlock', () => {
  it('unlocks on pointerup and keydown at document level and stops after unmount', async () => {
    const f = await setup();
    const rec = recordingAlerts();
    const view = renderApp(f.store, f.clock, '/', { alerts: rec.alerts });
    await screen.findByRole('banner');
    fireEvent.pointerUp(document.body);
    expect(rec.calls).toEqual(['unlock']);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(rec.calls).toEqual(['unlock', 'unlock']);
    view.unmount();
    fireEvent.pointerUp(document.body);
    expect(rec.calls).toEqual(['unlock', 'unlock']);
  });

  it('unlocks on the first tap after a reload', async () => {
    const { rec } = await renderOnStoreB(60);
    fireEvent.pointerUp(await screen.findByRole('heading', { name: 'Push-up' }));
    expect(rec.calls).toEqual(['unlock']);
  });

  it('unlocks even when a child stops the bubble', async () => {
    const f = await setup();
    const rec = recordingAlerts();
    renderApp(f.store, f.clock, '/', { alerts: rec.alerts });
    await screen.findByRole('banner');
    const child = document.createElement('div');
    child.onpointerup = (event) => event.stopPropagation();
    document.body.appendChild(child);
    try {
      fireEvent.pointerUp(child);
      expect(rec.calls).toEqual(['unlock']);
    } finally {
      child.remove();
    }
  });
});

describe('rest alerts on the Workout screen', () => {
  it('beeps at 10 s before the end, then at the end with a 1 s flash', async () => {
    const { f, rec } = await renderBase();
    await restTimer();
    await tick(f, T + 129_999);
    expect(rec.alertCalls()).toEqual([]);
    await tick(f, sec(130));
    expect(rec.alertCalls()).toEqual(['restWarning']);
    expect(flash()).toBeNull();
    await tick(f, sec(135));
    expect(rec.alertCalls()).toEqual(['restWarning']);
    await tick(f, sec(140));
    expect(rec.alertCalls()).toEqual(['restWarning', 'restEnd']);
    expect(flash()).not.toBeNull();
    await tick(f, T + 140_999);
    expect(flash()).not.toBeNull();
    await tick(f, sec(141));
    expect(flash()).toBeNull();
    await tick(f, sec(150));
    await tick(f, sec(200));
    expect(rec.alertCalls()).toEqual(['restWarning', 'restEnd']);
  });

  it('skips a late audio alert but still flashes for the end', async () => {
    const late = await renderBase();
    await restTimer();
    await tick(late.f, sec(120));
    await tick(late.f, T + 142_001);
    expect(late.rec.alertCalls()).toEqual([]);
    expect(flash()).not.toBeNull();
  });

  it('plays the end beep when it is exactly 2 s late', async () => {
    const { f, rec } = await renderBase();
    await restTimer();
    await tick(f, sec(120));
    await tick(f, sec(142));
    expect(rec.alertCalls()).toEqual(['restEnd']);
    expect(flash()).not.toBeNull();
  });

  it('fires the end after a reload that landed in the last 10 s', async () => {
    const { f, rec } = await renderOnStoreB(135);
    await restTimer();
    await tick(f, sec(136));
    expect(rec.alertCalls()).toEqual([]);
    await tick(f, sec(140));
    expect(rec.alertCalls()).toEqual(['restEnd']);
    expect(flash()).not.toBeNull();
  });

  it('stays silent after a reload that landed after the end', async () => {
    const { f, rec } = await renderOnStoreB(145);
    await restTimer();
    await tick(f, sec(146));
    await tick(f, sec(200));
    expect(rec.alertCalls()).toEqual([]);
    expect(flash()).toBeNull();
  });

  it('does not repeat the warning when Reps are saved during the rest', async () => {
    const user = userEvent.setup();
    setVisibility('visible');
    const f = await setup();
    await f.at(T).start();
    const opened = await f.at(sec(10)).openBlock(f.id('Push-up'));
    const blockId = opened.blocks[0]!.block.id;
    const running = await f.at(sec(20)).startSet(blockId);
    await f.at(sec(50)).doneSet(running.blocks[0]!.sets[0]!.id);
    const rec = recordingAlerts();
    f.clock.set(sec(60));
    renderApp(f.store, f.clock, '/workout', { alerts: rec.alerts });
    await screen.findByRole('status', { name: W.reps });
    await tick(f, sec(130));
    expect(rec.alertCalls()).toEqual(['restWarning']);
    expect(screen.getByRole('status', { name: W.reps })).toBeInTheDocument();
    f.clock.set(sec(131));
    await user.click(screen.getByRole('button', { name: W.save }));
    expect(await screen.findByText('Set 1: 10 reps')).toBeInTheDocument();
    await tick(f, sec(132));
    expect(rec.alertCalls()).toEqual(['restWarning']);
    await tick(f, sec(140));
    expect(rec.alertCalls()).toEqual(['restWarning', 'restEnd']);
  });

  it('plays nothing while hidden and flashes an end that is at most 60 s late', async () => {
    const { f, rec } = await renderBase();
    await restTimer();
    await settle();
    await act(async () => setVisibility('hidden'));
    await tick(f, sec(130));
    await tick(f, sec(141));
    expect(rec.alertCalls()).toEqual([]);
    await settle();
    await act(async () => setVisibility('visible'));
    await tick(f, sec(150));
    expect(rec.alertCalls()).toEqual([]);
    expect(flash()).not.toBeNull();
  });

  it('does not flash an end that is more than 60 s late', async () => {
    const { f, rec } = await renderBase();
    await restTimer();
    await settle();
    await act(async () => setVisibility('hidden'));
    await tick(f, sec(141));
    await settle();
    await act(async () => setVisibility('visible'));
    await tick(f, T + 200_001);
    expect(rec.alertCalls()).toEqual([]);
    expect(flash()).toBeNull();
  });

  it('re-arms thresholds when the planned rest changes', async () => {
    const user = userEvent.setup();
    const { f, rec } = await renderBase();
    await restTimer();
    await tick(f, sec(125));
    await user.click(screen.getByRole('button', { name: W.restLess }));
    await waitFor(() => expect(plannedRest()).toHaveTextContent('1:15'));
    await tick(f, sec(126));
    expect(rec.alertCalls()).toEqual([]);
    expect(flash()).toBeNull();
    await user.click(screen.getByRole('button', { name: W.restMore }));
    await waitFor(() => expect(plannedRest()).toHaveTextContent('1:30'));
    await user.click(screen.getByRole('button', { name: W.restMore }));
    await waitFor(() => expect(plannedRest()).toHaveTextContent('1:45'));
    await tick(f, T + 144_999);
    expect(rec.alertCalls()).toEqual([]);
    await tick(f, sec(145));
    expect(rec.alertCalls()).toEqual(['restWarning']);
    await tick(f, sec(155));
    expect(rec.alertCalls()).toEqual(['restWarning', 'restEnd']);
    expect(flash()).not.toBeNull();
  });

  it('skips the warning when the planned rest is lowered into the last 10 s', async () => {
    const user = userEvent.setup();
    const { f, rec } = await renderBase();
    await restTimer();
    await tick(f, sec(115));
    await user.click(screen.getByRole('button', { name: W.restLess }));
    await waitFor(() => expect(plannedRest()).toHaveTextContent('1:15'));
    await tick(f, sec(116));
    expect(rec.alertCalls()).toEqual([]);
    await tick(f, sec(125));
    expect(rec.alertCalls()).toEqual(['restEnd']);
    expect(flash()).not.toBeNull();
  });

  it('keeps focus and taps working through the flash', async () => {
    const user = userEvent.setup();
    const { f, rec } = await renderBase();
    await restTimer();
    const more = screen.getByRole('button', { name: W.restMore });
    more.focus();
    await tick(f, sec(140));
    expect(flash()).not.toBeNull();
    expect(document.activeElement).toBe(more);
    await user.click(screen.getByRole('button', { name: W.start }));
    expect(await screen.findByRole('timer', { name: W.setTimer })).toBeInTheDocument();
    await tick(f, sec(141));
    await tick(f, sec(250));
    expect(flash()).toBeNull();
    expect(rec.alertCalls()).toEqual(['restEnd']);
  });

  it('gives no alert on other screens', async () => {
    const { f, rec } = await renderBase(60, '/exercises');
    await screen.findByRole('banner');
    await tick(f, sec(130));
    await tick(f, sec(140));
    expect(rec.alertCalls()).toEqual([]);
    expect(flash()).toBeNull();
  });
});
