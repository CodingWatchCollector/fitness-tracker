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

The app deploys to Cloudflare Pages.

Every push to `main`, including a merged PR, deploys automatically. The `deploy` job in `.github/workflows/ci.yml` runs after `checks` and `e2e` pass. It needs two repo secrets: `CLOUDFLARE_API_TOKEN` (a token with Account > Cloudflare Pages > Edit) and `CLOUDFLARE_ACCOUNT_ID`.

To deploy by hand, run these in your own terminal, logged in to Cloudflare:

```sh
wrangler pages project create fitness-tracker   # once, also needed before the first CI deploy
pnpm run pages:deploy
```

`pnpm deploy` is a pnpm built-in, so the script is named `pages:deploy`.

The project was created with wrangler, so it is a Direct Upload project. Cloudflare can't switch it to Git integration, which is why CI does the deploy.

## Data rules

Only `src/data/db.ts` imports `dexie`. Every other module goes through `src/data/index.ts`.

Schema: never edit a shipped Dexie version. Index or store changes go in a new `version(n)`.

Record rules:

- Every write goes through the data module, which sets `updatedAt = now()` from the injected clock. Callers never set meta fields.
- A soft delete sets `deletedAt = updatedAt = now()`. Cascades (Workout to blocks to Sets) are explicit and give children the same timestamp.
- Reads return only `deletedAt === null` records unless a function says otherwise.
- Records are never hard-deleted, except by import-restore. Seed Exercises are never hard-deleted.
- Seed revision: seed Exercises carry `seedRevision: 1` (`SEED_REVISION` in `src/data/seed.ts`). Custom Exercises and seed Exercises the user has edited have `seedRevision: null`, which detaches them from the catalog. A future release that bumps `SEED_REVISION` patches only records with `custom === false && seedRevision !== null && seedRevision < SEED_REVISION`. A patch overwrites catalog fields only, keeps `id`, `createdAt`, `favorite` and `deletedAt`, and sets `updatedAt = now()`. Toggling `favorite` does not detach a record. Today the seed only inserts missing records.

Workout rules:

- At most one active Workout (`endedAt === null`). `workouts.start()` rejects with `workout-already-active` while one is open. If storage ever holds several open Workouts, the latest `startedAt` (tie: greater `id`) is the active one and the others are auto-closed.
- Auto-close: a Workout is stale 3 h (`AUTO_CLOSE_AFTER_MS`) after the latest `updatedAt` of the Workout, its blocks and its Sets, soft-deleted ones included. The close runs in its own committed transaction first in `workouts.current`, `start` and every mutation, so a call that then rejects with `no-active-workout` leaves the close in place. Every `ActiveWorkout` returned by `current`, `start` and the mutations carries `autoCloseAt` (the latest `updatedAt` plus 3 h, derived on every read, never stored); `finish()` resolves `null`. A visible Workout or Home screen re-reads `workouts.current()` once when the clock reaches it and whenever the page becomes visible, so a screen left open notices the close on its own.
- Close rule: Finish and auto-close share one rule, applied in a single transaction. (1) An unsaved last Set of the open block (running, or Done without Reps) is soft-deleted, and the previous Set's `restEndedAt` is reset to null if it equals the discarded Set's `startedAt`. (2) An open block without a saved Set is soft-deleted; otherwise it gets `endedAt` and its last saved Set gets `restEndedAt` if null. Finish uses `closeTime = max(now, latest stored time of the records that stay live)`; auto-close uses the last saved Set's `max(endedAt, restEndedAt)`. (3) The Workout gets `endedAt` (Finish: `closeTime`; auto-close: the latest `endedAt` of live saved Sets and live ended blocks, or `startedAt`) and `autoClosed`. Invariant for every closed Workout: no live unsaved Set; every live block has `endedAt <= Workout.endedAt`; every live Set has `endedAt <= restEndedAt <= block.endedAt`; a Set followed by another live Set has `restEndedAt` equal to that Set's `startedAt`.
- Rest starts at Done and ends at the next Start or End block, so actual rest includes Reps entry.

## Credits

Exercise photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (github.com/yuhonas/free-exercise-db, Unlicense), pinned at commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`.
