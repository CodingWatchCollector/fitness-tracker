# Fitness Tracker

An installable, offline-capable PWA for logging workouts on a phone. All data lives in IndexedDB on the device (see `docs/adr/0001-local-first-dexie.md`). MVP-a ships the exercise catalog: a list and a detail screen for 15 seeded Exercises.

## Install

```sh
pnpm install
pnpm exec playwright install chromium
pnpm icons
```

`pnpm icons` generates the PWA icons into `public/` from `public/favicon.svg`. The PNGs are kept as source files.

`pnpm-workspace.yaml` pins `workbox-build` to 7.4.0 and `rollup@^2` to 2.79.2 because pnpm's `no-downgrade` trust policy rejects the newer releases that `vite-plugin-pwa` would otherwise pull in. Drop the overrides once upstream passes the policy.

## Test

```sh
pnpm typecheck
pnpm lint
pnpm test          # unit and component tests (Vitest)
pnpm build
pnpm test:build    # checks dist/ (manifest, icons, precache list, photos)
pnpm test:e2e      # offline test in Chromium, needs dist/ from pnpm build
```

## Build and run

```sh
pnpm dev
pnpm build
pnpm preview
```

## Deploy

The app deploys to Cloudflare Pages. Run these in your own terminal, logged in to Cloudflare:

```sh
wrangler pages project create fitness-tracker   # once
pnpm run pages:deploy
```

`pnpm deploy` is a pnpm built-in, so the script is named `pages:deploy`.

## Data rules

Only `src/data/db.ts` imports `dexie`. Every other module goes through `src/data/index.ts`.

Schema: never edit a shipped Dexie version. Index or store changes go in a new `version(n)`.

Record rules:

- Every write goes through the data module, which sets `updatedAt = now()` from the injected clock. Callers never set meta fields.
- A soft delete sets `deletedAt = updatedAt = now()`. Cascades (Workout to blocks to Sets) are explicit and give children the same timestamp.
- Reads return only `deletedAt === null` records unless a function says otherwise.
- Records are never hard-deleted, except by import-restore. Seed Exercises are never hard-deleted.
- Seed revision: seed Exercises carry `seedRevision: 1` (`SEED_REVISION` in `src/data/seed.ts`). Custom Exercises and seed Exercises the user has edited have `seedRevision: null`, which detaches them from the catalog. A future release that bumps `SEED_REVISION` patches only records with `custom === false && seedRevision !== null && seedRevision < SEED_REVISION`. A patch overwrites catalog fields only, keeps `id`, `createdAt`, `favorite` and `deletedAt`, and sets `updatedAt = now()`. Toggling `favorite` does not detach a record. Today the seed only inserts missing records.

## Credits

Exercise photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (github.com/yuhonas/free-exercise-db, Unlicense), pinned at commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`.
