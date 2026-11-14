# ADR 0014: Statistics live in SQLite, apart from settings.json

**Status:** accepted, 2026-11-14
**Context:** `src-tauri/crates/mt-stats/`, `src-tauri/crates/mt-sim-iracing/src/ibt/`;
`CONTEXT.md` → Statistics

## Decision

Session records go into `stats.db`, a SQLite file (`rusqlite`, bundled) in the
app config dir beside `settings.json`, never into the settings. The stats
import (`mt-stats`) reads the sim's `.ibt` files into it: from app start, one
file at a time on a thread of its own, paused while the sim is connected, and
again each time the sim closes. A file it cannot read is stored as broken and
not retried until it changes on disk.

The database keeps **what each file held**: a run and its laps are rows of
that file (`run`, `lap`, keyed by the file's path). A session's figures — its
start, incidents, best lap, finish, field size — are merged from its files when
they are read back. Only what all files of a session agree on (track, car,
iRating at join…) is stored once, in `session`. `ibt_file` lists every file
seen with its size and modified time.

The reader is the sim's: `mt-sim-iracing::ibt` turns a file into a
`SessionFile` (`mt-model::app::stats`), and the app hands that function to
`mt-stats`, which names no sim.

## Why

- **Settings and statistics differ in kind.** Settings are a small document
  main owns and rewrites whole (ADR-0007), migrated by schema versions.
  Statistics are thousands of rows that only grow, are queried by date, car,
  track and category, and must outlive the `.ibt`s (the user's were deleted
  by another program once). A JSON file would be rewritten whole on every
  file read and queried by hand.
- **Rows per file, merged on read.** One session spans many files (a new one
  each time the driver gets in the car), they can arrive in any order, and a
  file may be read again — it grew, or a broken file was replaced. Summing on
  write (the survey's first schema) counts a re-read twice; per-file rows make
  a re-read replace exactly its own rows and nothing else.
- **Never while the sim runs.** The sim is writing the newest file and wants
  the disk; a cold import is disk-bound (8.5 GB on the user's PC).

## Considered

- **Into `settings.json`**: see above; it would also travel with every layout
  export and settings backup.
- **A key-value or JSON-lines store**: no queries; Home's blocks (per week, per
  category, top cars and tracks) are `GROUP BY`s.
- **The iRacing data API**: needs the driver's credentials and is iRacing's
  alone; `.ibt` files are local and cover offline sessions too.

## Consequences

- `stats.db` has its own schema version (`PRAGMA user_version`), stepped in
  `mt-stats::db::migrate`, independent of the settings schema.
- The table shows only what a file can prove: the finish is
  `PlayerCarPosition` under the checkered flag in the car (provisional, never
  official); a race left before the flag has none.
- A new sim adds its own reader beside its adapter; the import does not change.
- The `.ibt` folder the driver chooses lives in `stats.db` (`setting` table,
  schema step 2), not in `settings.json`: only the import reads it, and a
  settings reset leaves the records and where they come from alone.
