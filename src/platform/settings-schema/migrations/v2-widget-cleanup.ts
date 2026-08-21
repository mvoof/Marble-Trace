import type { Migration, SettingsBlob } from '../types';
import { patchWidgetSettings, removeWidgets } from '../blob';

/**
 * v1 → v2. Drops the `example` widget (the telemetry debug panel), which no
 * longer exists in the build. Without this the id survives in `widgets[]` and in
 * every `layouts[].widgets[]`, and the registry hands the canvas `undefined` for
 * it at mount time.
 *
 * It also seeds `showPlaceholder` on the stream chat widget, which shipped in
 * 0.21 without the flag and always drew the "waiting for messages" line. The
 * top-level copy would be repaired by `mergeWithDefaults` on its own, but in
 * `layouts[].widgets[]` a missing boolean reads as `false` — so every layout
 * written before this build would silently lose the placeholder instead of
 * keeping the behaviour it had.
 *
 * Two unrelated repairs share one step because v2 has never shipped: it was
 * added after 0.21 and no released file has ever been at this version. Once a
 * step is out in a release it is frozen — a file already migrated past it never
 * runs it again, so anything added to it later would reach nobody.
 *
 * The ids, the key and the value are frozen as literals here on purpose — this
 * step must keep meaning exactly "remove `example`, and the placeholder used to
 * be on" no matter what the registry and the defaults hold later.
 */
const REMOVED_WIDGET_IDS = ['example'] as const;

const CHAT_WIDGET_ID = 'stream-chat';
const PLACEHOLDER_KEY = 'showPlaceholder';

export const v2WidgetCleanup: Migration = {
  to: 2,
  describe: 'drop the removed example widget, seed the stream chat placeholder',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    patchWidgetSettings(
      removeWidgets(blob, REMOVED_WIDGET_IDS),
      CHAT_WIDGET_ID,
      (settings) => {
        if (PLACEHOLDER_KEY in settings) {
          return settings;
        }

        return { ...settings, [PLACEHOLDER_KEY]: true };
      }
    ),
};
