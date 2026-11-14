import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { strings } from '../src/strings';

const PUSH_UP_ID = '877ec463-3998-4ea3-87a5-abb0ae6332d7';
const MIN_TAP = 48;

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

async function expectTall(locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TAP);
}

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto(baseURL);
  const list = page.getByRole('list', { name: strings.exerciseList.title });
  await expect(list.getByRole('listitem')).toHaveCount(15);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await server.close();
  if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections();
  await context.setOffline(true);

  const fetchFailed = await page.evaluate(() =>
    fetch('/__not-precached-' + Date.now()).then(
      () => false,
      () => true,
    ),
  );
  expect(fetchFailed).toBe(true);

  await page.reload();
  const items = list.getByRole('listitem');
  await expect(items).toHaveCount(15);
  for (const item of await items.all()) await expectTall(item);

  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = (bodyBackground.match(/\d+/g) ?? []).map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeLessThanOrEqual(0.1);

  await page
    .getByRole('link', { name: /Push-up/ })
    .first()
    .click();
  const start = page.getByRole('img', { name: 'Push-up start position' });
  await expect(start).toBeVisible();
  await expect
    .poll(() => start.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expectTall(page.getByRole('link', { name: strings.back }));

  await page.goto(new URL(`/exercises/${PUSH_UP_ID}`, baseURL).href);
  await expect(page.getByRole('heading', { name: 'Push-up' })).toBeVisible();

  await page.goto(new URL('/exercises/not-a-real-id', baseURL).href);
  await expect(page.getByText(strings.exerciseDetail.notFound)).toBeVisible();
  await expectTall(page.getByRole('link', { name: strings.back }));
});
