import type { Migration, SettingsBlob } from '../types';
import { removeWidgets } from '../blob';

/**
 * v1 → v2. Drops the `example` widget (the telemetry debug panel), which no
 * longer exists in the build. Without this the id survives in `widgets[]` and in
 * every `layouts[].widgets[]`, and the registry hands the canvas `undefined` for
 * it at mount time.
 *
 * The id is frozen as a literal here on purpose — this step must keep meaning
 * exactly "remove `example`" no matter what the registry holds later.
 */
const REMOVED_WIDGET_IDS = ['example'] as const;

export const v2DropExampleWidget: Migration = {
  to: 2,
  describe: 'drop the removed example widget',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    removeWidgets(blob, REMOVED_WIDGET_IDS),
};
