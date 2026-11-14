# Local-first storage in IndexedDB via Dexie, sync later

The MVP has no backend: all data lives on the phone in IndexedDB, accessed through Dexie, and every storage call goes through a single data module. The app must work fully offline in the gym, and one user's data is small (about 5,000 sets a year), so stats computed in code are fast enough and SQL buys little. SQLite compiled to WebAssembly was rejected for the MVP because of its ~1 MB download, its worker and OPFS setup, and the extra server headers it needs. Records carry UUID ids, `createdAt`/`updatedAt` and soft deletes, so account-based sync can be added later without migrating data.

## Consequences

- Until sync exists, the phone holds the only copy, so the MVP ships JSON import for restoring backups and asks the browser for persistent storage.
- Moving to native SQLite (for example inside a Capacitor app store build) or to a sync engine changes only the data module.
