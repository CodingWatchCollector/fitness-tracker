import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '..', '..', 'dist');

const JPEG_SIZES: Record<string, number> = {
  'Pushups/0': 66786,
  'Pushups/1': 64283,
  'Pullups/0': 42281,
  'Pullups/1': 40018,
  'Parallel_Bar_Dip/0': 53482,
  'Parallel_Bar_Dip/1': 49592,
  'Inverted_Row_with_Straps/0': 64313,
  'Inverted_Row_with_Straps/1': 64242,
  'Bodyweight_Squat/0': 37986,
  'Bodyweight_Squat/1': 41546,
};

beforeAll(() => {
  if (!existsSync(DIST))
    throw new Error('dist/ is missing: run "pnpm build" before "pnpm test:build"');
});

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function distFile(url: string): string {
  return join(DIST, url.replace(/^\//, ''));
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe('PWA build output', () => {
  it('has an installable manifest', () => {
    const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(luminance(manifest.background_color)).toBeLessThanOrEqual(0.1);
    expect(luminance(manifest.theme_color)).toBeLessThanOrEqual(0.1);

    const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons;
    for (const icon of icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(distFile(icon.src))).toEqual({ width: w, height: h });
    }
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && !i.purpose?.includes('maskable'))).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose?.includes('maskable'))).toBe(true);
  });

  it('links the manifest, theme colour and apple-touch icon from index.html', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(html).toMatch(/<link rel="manifest"/);
    expect(html).toMatch(/<meta name="theme-color"/);
    const touch = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html);
    expect(touch).not.toBeNull();
    expect(pngSize(distFile(touch![1]!))).toEqual({ width: 180, height: 180 });
  });

  it('precaches the shell, the bundles and all bundled photos', () => {
    const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]!);

    expect(urls).toContain('index.html');
    const assets = walk(join(DIST, 'assets')).filter((f) => /\.(js|css)$/.test(f));
    expect(assets.length).toBeGreaterThan(0);
    for (const file of assets) {
      expect(urls).toContain(`assets/${file.split('/assets/')[1]}`);
    }
    const jpgs = urls.filter((u) => /^exercise-images\/.+\.jpg$/.test(u));
    expect(jpgs.length).toBeGreaterThanOrEqual(10);
    for (const key of Object.keys(JPEG_SIZES)) {
      expect(urls).toContain(`exercise-images/${key}.jpg`);
    }
  });

  it('ships intact photos', () => {
    for (const [key, size] of Object.entries(JPEG_SIZES)) {
      const file = join(DIST, 'exercise-images', `${key}.jpg`);
      expect(statSync(file).size).toBe(size);
      expect(readFileSync(file).subarray(0, 3).toString('hex')).toBe('ffd8ff');
    }
  });

  it('emits no 404.html', () => {
    expect(existsSync(join(DIST, '404.html'))).toBe(false);
  });
});
