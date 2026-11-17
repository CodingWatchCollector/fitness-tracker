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
