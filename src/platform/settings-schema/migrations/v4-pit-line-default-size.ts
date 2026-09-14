import type { Migration, SettingsBlob } from '../types';
import { asObject, mapEveryWidget } from '../blob';

/**
 * v3 → v4. The Pit Line widget ships as a tall, narrow strip.
 *
 * The widget did not change shape — the bars are the same two columns filling
 * whatever height they are given — only the size it is handed out at: a 120×150
 * box is read as a plate, and the lane is read as a strip down the edge of the
 * screen. Nothing derives a size from this, so `mergeWithDefaults` would never
 * reach a file that already holds one, which is why it takes a step of its own.
 *
 * Only a widget still sitting on the *old default in both axes* is rebased. A
 * driver who dragged the bar to a size of their own meant that size, and one
 * axis differing is enough to leave the pair alone — the same rule the delta's
 * plate was rebased under in v3.
 *
 * Every literal is frozen: this step has to keep meaning "move the pit line off
 * the 120×150 it shipped at" however the manifest is defaulted later.
 */
const PIT_LINE_ID = 'pit-line';

const OLD_WIDTH_PX = 120;
const OLD_HEIGHT_PX = 150;
const NEW_WIDTH_PX = 80;
const NEW_HEIGHT_PX = 380;

export const v4PitLineDefaultSize: Migration = {
  to: 4,
  describe: 'ship the pit line at the tall strip it is read as',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    mapEveryWidget(blob, (widgets) =>
      widgets.map((widget) => {
        // A copy names the widget it is a copy of in `type`; on the original the
        // id is the type. Structural, so no live helper is imported.
        if ((widget?.type ?? widget?.id) !== PIT_LINE_ID) {
          return widget;
        }

        const settings = asObject(widget.userSettings) ?? {};

        if (
          settings['currentWidth'] !== OLD_WIDTH_PX ||
          settings['currentHeight'] !== OLD_HEIGHT_PX
        ) {
          return widget;
        }

        return {
          ...widget,
          userSettings: {
            ...settings,
            currentWidth: NEW_WIDTH_PX,
            currentHeight: NEW_HEIGHT_PX,
          },
        };
      })
    ),
};
