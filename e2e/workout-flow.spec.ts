import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { strings } from '../src/strings';

test.use({ ...devices['Pixel 7'] });

let server: PreviewServer;
let baseURL: string;

test.beforeAll(async () => {
  if (!existsSync(join(process.cwd(), 'dist', 'index.html'))) {
    throw new Error('dist/ is missing: run "pnpm build" before "pnpm test:e2e"');
  }
  server = await preview({ preview: { port: 0 } });
  baseURL = server.resolvedUrls!.local[0]!;
});

test.afterAll(async () => {
  await server.close();
});

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function startWorkoutWithPushUp(page: Page) {
  await page.goto(baseURL);
  await button(page, strings.home.startWorkout).click();
  await page.getByRole('searchbox', { name: strings.picker.search }).fill('push');
  await button(page, 'Push-up').click();
  await expect(page.getByRole('heading', { name: 'Push-up', exact: true })).toBeVisible();
}

async function logSet(page: Page) {
  await button(page, strings.workout.start).click();
  await button(page, strings.workout.done).click();
  await button(page, strings.workout.save).click();
}

test('AC-12 runs two Sets, resumes after a reload, ends the block and finishes', async ({
  page,
}) => {
  await startWorkoutWithPushUp(page);

  await logSet(page);
  const restTimer = page.getByRole('timer', { name: strings.workout.restTimer });
  await expect(restTimer).toBeVisible();
  await expect(page.getByText(strings.workout.restPhase.countdown, { exact: true })).toBeVisible();

  await logSet(page);
  await expect(page.getByText(/^Set 1: \d+ reps?$/)).toBeVisible();
  await expect(page.getByText(/^Set 2: \d+ reps?$/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Push-up', exact: true })).toBeVisible();
  await expect(page.getByText(/^Set \d+: \d+ reps?$/)).toHaveCount(2);
  await expect(page.getByRole('timer', { name: strings.workout.restTimer })).toBeVisible();

  await button(page, strings.workout.endBlock.resting).click();
  await expect(page.getByRole('list', { name: strings.picker.all })).toBeVisible();

  await button(page, strings.workout.finish).click();
  await button(page, strings.workout.finishDialog.confirm).click();
  await expect(button(page, strings.home.startWorkout)).toBeVisible();
});

test('AC-12 offers Resume Workout on Home after a reload mid-Workout', async ({ page }) => {
  await startWorkoutWithPushUp(page);

  await page.goto(baseURL);
  const resume = page.getByRole('link', { name: strings.home.resumeWorkout, exact: true });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole('heading', { name: 'Push-up', exact: true })).toBeVisible();
});

test('the Finish dialog is modal: the page behind it is blocked and Escape closes it', async ({
  page,
}) => {
  await startWorkoutWithPushUp(page);

  await button(page, strings.workout.finish).click();
  const dialog = page.getByRole('dialog', { name: strings.workout.finishDialog.title });
  await expect(dialog).toBeVisible();
  await expect(button(page, strings.workout.finishDialog.cancel)).toBeFocused();
  expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(true);
  await page.getByRole('link', { name: strings.appName }).click({ force: true });
  await button(page, strings.workout.start).click({ force: true });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('timer', { name: strings.workout.setTimer })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button(page, strings.workout.finish)).toBeFocused();
  await expect(page.getByRole('link', { name: strings.appName })).toBeVisible();
});

test('AC-6 keeps focus on the planned-rest more button across Enter presses', async ({ page }) => {
  await startWorkoutWithPushUp(page);

  const more = button(page, strings.workout.restMore);
  const output = page.getByLabel(strings.workout.plannedRest);
  await expect(output).toHaveText(/\d+:\d{2}/);
  const before = parseClock((await output.textContent()) ?? '');

  await more.focus();
  await expect(more).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(output).toHaveText(strings.clock(before + 15));
  await expect(more).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(output).toHaveText(strings.clock(before + 30));
  await expect(more).toBeFocused();
});

function parseClock(text: string): number {
  const [minutes, seconds] = text.trim().split(':').map(Number);
  return minutes! * 60 + seconds!;
}

type AlertLogEntry = {
  type: 'resume' | 'tone' | 'vibrate';
  hz?: number;
  ms?: number;
  pattern?: number[];
};

declare global {
  interface Window {
    __restAlertLog: AlertLogEntry[];
  }
}

function installAlertRecorders() {
  const log: AlertLogEntry[] = [];
  window.__restAlertLog = log;

  function createOscillator() {
    const self = {
      type: 'sine',
      hz: 0,
      startWhen: 0,
      frequency: {
        set value(v: number) {
          self.hz = v;
        },
        get value() {
          return self.hz;
        },
        setValueAtTime(v: number) {
          self.hz = v;
        },
      },
      connect() {},
      start(when = 0) {
        self.startWhen = when;
      },
      stop(when = 0) {
        log.push({ type: 'tone', hz: self.hz, ms: Math.round((when - self.startWhen) * 1000) });
      },
    };
    return self;
  }

  const param = () => ({
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });

  class FakeAudioContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    resume() {
      this.state = 'running';
      log.push({ type: 'resume' });
      return Promise.resolve();
    }
    createOscillator() {
      return createOscillator();
    }
    createGain() {
      return { gain: param(), connect() {} };
    }
  }

  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  Navigator.prototype.vibrate = (pattern: Iterable<number> | number) => {
    log.push({ type: 'vibrate', pattern: [...(pattern as Iterable<number>)] });
    return true;
  };
}

const readAlertLog = (page: Page) => page.evaluate(() => window.__restAlertLog);

async function expectMinHeight(locator: ReturnType<Page['locator']>, min: number, width = 0) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(min);
  expect(box!.width).toBeGreaterThanOrEqual(width);
}

test('AC-8 beeps at 10 s before rest end, then long beep, vibration and flash at the end, once after a reload', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.addInitScript(installAlertRecorders);
  await startWorkoutWithPushUp(page);

  const more = button(page, strings.workout.restMore);
  const less = button(page, strings.workout.restLess);
  const start = button(page, strings.workout.start);
  for (let i = 0; i < 4; i++) await less.click();
  await expect(page.getByLabel(strings.workout.plannedRest)).toHaveText('0:30');
  await expectMinHeight(start, 64);
  await expectMinHeight(less, 64, 64);
  await expectMinHeight(more, 64, 64);

  await start.click();
  const setTimer = page.getByRole('timer', { name: strings.workout.setTimer });
  expect(await setTimer.evaluate((el) => getComputedStyle(el).fontSize)).toBe('56px');
  await expectMinHeight(button(page, strings.workout.done), 64);

  await button(page, strings.workout.done).click();
  await expectMinHeight(button(page, strings.workout.save), 64);
  await button(page, strings.workout.save).click();

  const restTimer = page.getByRole('timer', { name: strings.workout.restTimer });
  await expect(restTimer).toBeVisible();
  await expect(page.getByText(strings.workout.restPhase.countdown, { exact: true })).toBeVisible();
  expect(await restTimer.evaluate((el) => getComputedStyle(el).fontSize)).toBe('96px');

  const first = parseClock((await restTimer.textContent()) ?? '');
  await expect
    .poll(async () => parseClock((await restTimer.textContent()) ?? ''), { timeout: 5_000 })
    .toBeLessThan(first);

  await expect
    .poll(
      async () =>
        (await readAlertLog(page)).filter((e) => e.type === 'tone' && e.ms === 200).length,
      {
        timeout: 25_000,
      },
    )
    .toBeGreaterThan(0);
  const beforeReload = await readAlertLog(page);
  expect(beforeReload.filter((e) => e.type === 'tone' && e.ms === 200)).toEqual([
    { type: 'tone', hz: 880, ms: 200 },
  ]);
  expect(beforeReload.filter((e) => e.type === 'tone' && e.ms === 800)).toEqual([]);
  expect(beforeReload.filter((e) => e.type === 'vibrate')).toEqual([]);

  await page.reload();
  const heading = page.getByRole('heading', { name: 'Push-up', exact: true });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('timer', { name: strings.workout.restTimer })).toBeVisible();
  await expect(page.getByText(strings.workout.restPhase.countdown, { exact: true })).toBeVisible();

  await heading.click();
  expect((await readAlertLog(page)).filter((e) => e.type === 'resume').length).toBeGreaterThan(0);

  await start.scrollIntoViewIfNeeded();
  const box = (await start.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const probe = await page.waitForFunction(
    ({ x, y }) => {
      const flash = document.querySelector('.rest-flash');
      if (!flash) return null;
      return {
        pointerEvents: getComputedStyle(flash).pointerEvents,
        hit: document.elementFromPoint(x, y)?.closest('button')?.textContent,
        activeIsFlash: document.activeElement === flash,
      };
    },
    centre,
    { polling: 'raf', timeout: 25_000 },
  );
  expect(await probe.jsonValue()).toEqual({
    pointerEvents: 'none',
    hit: strings.workout.start,
    activeIsFlash: false,
  });

  const afterReload = await readAlertLog(page);
  expect(afterReload.filter((e) => e.type === 'tone' && e.ms === 800)).toEqual([
    { type: 'tone', hz: 880, ms: 800 },
  ]);
  expect(afterReload.filter((e) => e.type === 'vibrate')).toEqual([
    { type: 'vibrate', pattern: [400, 100, 400] },
  ]);
  expect(afterReload.filter((e) => e.type === 'tone' && e.ms === 200)).toEqual([]);

  await expect(page.getByText(strings.workout.restPhase.overtime, { exact: true })).toBeVisible({
    timeout: 25_000,
  });
  const overtime = page.getByRole('timer', { name: strings.workout.restTimer });
  await expect(overtime).toHaveText(/^\+\d+:\d{2}$/);
  expect(await overtime.evaluate((el) => getComputedStyle(el).fontSize)).toBe('64px');
  const ob = (await overtime.boundingBox())!;
  expect(ob.x).toBeGreaterThanOrEqual(0);
  expect(ob.x + ob.width).toBeLessThanOrEqual(412);

  await expectMinHeight(button(page, strings.workout.endBlock.resting), 64);
  await expectMinHeight(start, 64);
});
