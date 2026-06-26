# test-data

Captured telemetry snapshot used as the realistic base for widget previews and
Storybook.

## Files

| File                         | Contents                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `iracing-1780155523590.json` | iRacing telemetry snapshot — realistic multi-car session (drivers, classes, timing) |

The snapshot is loaded by the neutral preview fixture
`src/store/preview/sample-telemetry.ts` (globbed as `iracing-*.json`) and shared
by both the in-app widget preview and Storybook.

> [!NOTE]
> Specific states (flags, radar traffic, rain, table badges) and the track map
> are **synthetic** — see `src/store/preview/scenarios.ts` and
> `src/store/preview/sample-track.ts`. A recorded session can't guarantee those
> states occur, let alone from the first frame, so they are generated
> deterministically rather than recorded.

## How to capture a fresh telemetry snapshot

1. Launch iRacing and join a session
2. Launch Marble Trace (`npm run tauri dev`)
3. Go to **Settings → Dev Tools → Capture Snapshot**
4. A JSON file will be downloaded
5. Place it in this folder (e.g. `test-data/gt3-race.json`)
