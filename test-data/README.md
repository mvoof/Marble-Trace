# test-data

Captured telemetry snapshot used as the realistic base for widget previews and
Storybook.

## Files

| File                                       | Contents                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `telemetry-snapshot-2026-09-07_02-13.json` | iRacing telemetry snapshot — realistic multi-car session (drivers, classes, timing) |

The snapshot is loaded by the neutral preview fixture
`src/store/preview/sample-telemetry.ts` (globbed as `telemetry-snapshot-*.json`,
first match wins) and shared by both the in-app widget preview and Storybook.

> [!NOTE]
> Specific states (flags, radar traffic, rain, table badges) and the track map
> are **synthetic** — see `src/store/preview/scenarios.ts` and
> `src/store/preview/sample-track.ts`. A recorded session can't guarantee those
> states occur, let alone from the first frame, so they are generated
> deterministically rather than recorded.

## How to capture a fresh telemetry snapshot

1. Launch iRacing and join a session
2. Launch Marble Trace (`npm run tauri dev`)
3. Go to **Settings → Maintenance → Developer Tools → Save Snapshot JSON**
4. The file is written to `diagnostics/` next to the settings file, and the
   folder is revealed
5. Move it here, keeping the `telemetry-snapshot-*.json` name, and remove the
   previous one — the glob takes the first match, so two snapshots make the
   fixture ambiguous
