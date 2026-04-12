# test-data

Captured telemetry snapshots for Storybook.

## How to capture

1. Launch iRacing and join a session
2. Launch Marble Trace (`npm run tauri dev`)
3. Go to **Settings → Dev Tools → Capture Snapshot**
4. A JSON file will be downloaded
5. Place it in this folder (e.g. `test-data/gt3-race.json`)

## How to use in stories

```tsx
import snapshot from '../../../test-data/gt3-race.json';
import { withTelemetry } from '../storybook/telemetryDecorator';

export const Default: Story = {
  decorators: [withTelemetry(snapshot)],
};
```
