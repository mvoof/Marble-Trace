# ADR 0015: Settings in settings.json, data in SQLite

**Status:** accepted, 2026-11-16
**Context:** `src/entities/app-settings/app-settings.store.ts`,
`src/app/sync/main/stats-folder-sync.ts`, `src-tauri/crates/mt-stats/`;
amends ADR-0014 → Consequences (the folder)

## Decision

Every **setting** lives in `settings.json`: UI, windows, preferences, the
`.ibt` folder statistics read (`statsFolder`), and the lap analysis' options
(`analysisKeepWhileGameRuns`, `analysisChannels`). `stats.db` holds **data**:
what was read from `.ibt` files, and the analysis lap set (which laps, their
colours, the reference lap).

The backend keeps no setting of its own. Main sends the folder with
`set_stats_folder` after loading the settings and on every change; the import
waits for that first push, so it never reads a folder the settings do not
name. Locked settings push the game's own folder.

`stats.db` step 4 drops the `setting` table. The folder row it held is handed
over once (`take_legacy_stats_folder`) and lands in the settings when they
name none.

## Why

- **One place for state the user chose.** Settings already have schema
  versions, migrations, backups, the last-good copy and the main → overlay →
  remote sync (ADR-0007); a second store of preferences gets none of it, and
  a reset or a restore would leave half the choices behind.
- **The database is rebuildable.** Everything in it but the lap set comes
  back from the files by a re-import, so it can be deleted without losing a
  choice. A preference in it would break that.
- **The lap set is data, not a setting**: it names laps of a session in the
  database and is meaningless without those rows.

## Considered

- **Keep the folder in `stats.db`** (ADR-0014's choice: only the import reads
  it, and a settings reset leaves where the records come from alone). Rejected:
  the analysis brings more preferences, and splitting them by which side reads
  them is not a rule the user can see.
- **The backend reads `settings.json` itself.** Rejected:
  `app/sync/main/settings-file.ts` is the only module that knows the file's
  shape, and main is its only writer.

## Consequences

- A settings reset sends the import back to the game's own folder.
- A folder missing on disk is accepted and reported as "no folder" by the
  pass, rather than refused: the settings hold it either way.
- A new preference goes to `DEFAULT_APP_SETTINGS`, never to a table.
