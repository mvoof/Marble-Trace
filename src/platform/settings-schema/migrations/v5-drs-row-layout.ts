import type { Migration, SettingsBlob } from '../types';
import { asObject, mapEveryWidget } from '../blob';

/**
 * v4 → v5. The DRS plate became a row.
 *
 * It used to stack its name over its state in a narrow box; it now sets a wing
 * mark, a rule, the name and the state on one line, which needs a wider
 * coordinate system to lay out in.
 *
 * That coordinate system is `designWidth`/`designHeight`, and it is written to
 * the file. `--wfs` is `currentWidth / designWidth`, so a file still holding the
 * old 136 scales the new row by 1.58 and overflows the plate at *every* size the
 * driver picks — widening the widget cannot fix it, because both terms grow
 * together. `mergeWithDefaults` only fills what is missing, so a design size
 * already on disk outlives the widget that declared it, and this step is the
 * only thing that can move it.
 *
 * The two pairs are rebased under different rules, because they mean different
 * things. The design size is build data — what this build's widget was drawn
 * against, never a choice — so it moves wherever the old pair is found. The
 * current size is the box the driver put on their screen, so it moves only when
 * both axes are still on the shipped default, the rule v4 rebased the pit line
 * under.
 *
 * Every literal is frozen: this step has to keep meaning "move the DRS plate off
 * the 136×46 it was stacked in" however the manifest is defaulted later.
 */
const DRS_ID = 'drs';

const OLD_WIDTH_PX = 136;
const OLD_HEIGHT_PX = 46;
const NEW_WIDTH_PX = 215;
const NEW_HEIGHT_PX = 56;

export const v5DrsRowLayout: Migration = {
  to: 5,
  describe: 'give the DRS plate the width its row lays out in',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    mapEveryWidget(blob, (widgets) =>
      widgets.map((widget) => {
        // A copy names the widget it is a copy of in `type`; on the original the
        // id is the type. Structural, so no live helper is imported.
        if ((widget?.type ?? widget?.id) !== DRS_ID) {
          return widget;
        }

        const settings = asObject(widget.userSettings) ?? {};

        const onOldDesign =
          widget.designWidth === OLD_WIDTH_PX &&
          widget.designHeight === OLD_HEIGHT_PX;

        const onOldBox =
          settings['currentWidth'] === OLD_WIDTH_PX &&
          settings['currentHeight'] === OLD_HEIGHT_PX;

        if (!onOldDesign && !onOldBox) {
          return widget;
        }

        return {
          ...widget,
          ...(onOldDesign
            ? { designWidth: NEW_WIDTH_PX, designHeight: NEW_HEIGHT_PX }
            : {}),
          userSettings: onOldBox
            ? {
                ...settings,
                currentWidth: NEW_WIDTH_PX,
                currentHeight: NEW_HEIGHT_PX,
              }
            : settings,
        };
      })
    ),
};
