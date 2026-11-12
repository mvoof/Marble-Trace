import {
  applyDerivedDesignWidth,
  deriveWidgetDesignWidth,
} from '@entities/widget/layout-resize';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

/**
 * Whether a synced list names exactly the widgets already held, in any order.
 *
 * The set is what adopting a list is for, and the set almost never changes: a
 * drag sends a snapshot every few frames, and rebuilding the collection each
 * time rerenders every widget's content — canvases and all — while the user is
 * only moving one of them. The same set is patched in place instead.
 */
export const isSameWidgetSet = (
  known: ReadonlyMap<string, WidgetDefaultConfig>,
  incoming: WidgetDefaultConfig[]
): boolean =>
  known.size === incoming.length &&
  incoming.every((widget) => known.has(widget.id));

/**
 * Writes a synced copy of a widget onto the record held here. The monitor
 * travels with it: "move to monitor" in one window changes nothing but the
 * monitor and the position, and the other window has to follow both.
 * Mutates `existing`.
 */
export const patchFromSync = (
  existing: WidgetDefaultConfig,
  incoming: WidgetDefaultConfig
): void => {
  Object.assign(existing.userSettings, incoming.userSettings);

  if (incoming.monitor !== undefined) {
    existing.monitor = incoming.monitor;
  }

  if (incoming.hotkeys === undefined) {
    delete existing.hotkeys;
  } else {
    existing.hotkeys = incoming.hotkeys;
  }

  existing.designWidth = deriveWidgetDesignWidth(
    incoming.type,
    existing.userSettings,
    incoming.designWidth
  );
  existing.designHeight = incoming.designHeight;
};

/**
 * The widget list a window holds after adopting one received from elsewhere:
 * a widget already here is patched and kept, one that is new is installed
 * beside it, one the list no longer names is dropped.
 *
 * Nothing the list left out is filled with its shipped default — the list is
 * already the answer, and the window would draw records its sender never had.
 */
export const adoptWidgetSet = (
  known: ReadonlyMap<string, WidgetDefaultConfig>,
  incoming: WidgetDefaultConfig[]
): WidgetDefaultConfig[] =>
  incoming.map((widget) => {
    const existing = known.get(widget.id);

    if (!existing) {
      const installed: WidgetDefaultConfig = {
        ...widget,
        userSettings: { ...widget.userSettings },
      };

      applyDerivedDesignWidth(widget.type, installed);

      return installed;
    }

    patchFromSync(existing, widget);

    return existing;
  });
