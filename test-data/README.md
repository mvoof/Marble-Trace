# test-data

Captured telemetry snapshots and recorded track data for Storybook.

## Files

| File                         | Contents                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `iracing-1776008424511.json` | iRacing telemetry snapshot — GT3 race at Lime Rock Park (4 sectors, multi-car) |
| `tracks.json`                | Recorded track geometry — Lime Rock Park (track ID 508, 469 points, version 2) |

## How to capture a telemetry snapshot

1. Launch iRacing and join a session
2. Launch Marble Trace (`npm run tauri dev`)
3. Go to **Settings → Dev Tools → Capture Snapshot**
4. A JSON file will be downloaded
5. Place it in this folder (e.g. `test-data/gt3-race.json`)

## How to capture a track recording

1. Drive a full lap in iRacing with Marble Trace running
2. The TrackMap widget auto-records the track on the first complete lap
3. Open **Settings → TrackMap widget → Show tracks.json path** to find the file
4. Copy the relevant track entry into `test-data/tracks.json` under `recorded-tracks`

## How to use in stories

```tsx
import snapshot from '../../../../test-data/iracing-1776008424511.json';
import tracksData from '../../../../test-data/tracks.json';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';

const realSnapshot = snapshot as TelemetrySnapshot;
const storedTracks = tracksData as {
  'recorded-tracks': Record<string, TrackData>;
};
const realTrack = Object.values(storedTracks['recorded-tracks'])[0];
```
