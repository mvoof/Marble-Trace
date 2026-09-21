import type { Migration, SettingsBlob } from '../types';
import { asObject, mapEveryWidget } from '../blob';

/**
 * v4 → v5. Two widgets were redrawn against a different coordinate system.
 *
 * That coordinate system is `designWidth`/`designHeight`, and it is written to
 * the file. `--wfs` is `currentWidth / designWidth`, so a file still holding the
 * old number scales the new drawing and overflows the plate at *every* size the
 * driver picks — widening the widget cannot fix it, because both terms grow
 * together. `mergeWithDefaults` only fills what is missing, so a design size
 * already on disk outlives the widget that declared it, and this step is the
 * only thing that can move it.
 *
 * The DRS plate used to stack its name over its state in a narrow box; it now
 * sets a wing mark, a rule, the name and the state on one line. The engine
 * panel stopped being one run of equal cells and became plates grouped by
 * system, with a lead value drawn large in each — twice the height and a
 * quarter more width.
 *
 * Three kinds of value, three rules, because they mean different things:
 *
 * - the **design size** is build data — what this build's widget was drawn
 *   against, never a choice — so it moves wherever the old pair is found;
 * - the **current size** is the box the driver put on their screen, so it moves
 *   only when both axes are still on the shipped default, the rule v4 rebased
 *   the pit line under;
 * - a **setting** that was itself a shipped default moves under that same rule
 *   and on its own: a driver still on the old column ceiling gets the new one,
 *   a driver who picked their own keeps it. It is not gated on the size,
 *   because resizing a widget says nothing about its columns.
 *
 * Every literal is frozen. This step has to keep meaning "move these two
 * widgets off the sizes they were drawn in" however the manifests are defaulted
 * later.
 */
interface DesignRebase {
  /** Widget type, which on an original is also its id. */
  id: string;
  from: { width: number; height: number };
  to: { width: number; height: number };
  /** Settings still on the old shipped default, and what it became. */
  settings?: Record<string, { from: number; to: number }>;
}

const REBASES: readonly DesignRebase[] = [
  {
    id: 'drs',
    from: { width: 136, height: 46 },
    to: { width: 215, height: 56 },
  },
  {
    id: 'engine-panel',
    from: { width: 500, height: 65 },
    to: { width: 687.5, height: 124 },
    settings: {
      // The ceiling is counted in width units now, and a lead cell is two of
      // them: on the old 8 the traction plate no longer shares a row with the
      // brake plate and the panel grows a third row.
      horizontalColumns: { from: 8, to: 12 },
      verticalColumns: { from: 2, to: 3 },
    },
  },
];

const rebaseSettings = (
  settings: Record<string, unknown>,
  rebase: DesignRebase
): Record<string, unknown> => {
  const onOldBox =
    settings['currentWidth'] === rebase.from.width &&
    settings['currentHeight'] === rebase.from.height;

  const moved: Record<string, unknown> = { ...settings };

  if (onOldBox) {
    moved['currentWidth'] = rebase.to.width;
    moved['currentHeight'] = rebase.to.height;
  }

  for (const [key, step] of Object.entries(rebase.settings ?? {})) {
    if (moved[key] === step.from) {
      moved[key] = step.to;
    }
  }

  return moved;
};

export const v5WidgetDesignSizes: Migration = {
  to: 5,
  describe:
    'move the DRS plate and the engine panel onto the sizes they are drawn in',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    mapEveryWidget(blob, (widgets) =>
      widgets.map((widget) => {
        // A copy names the widget it is a copy of in `type`; on the original the
        // id is the type. Structural, so no live helper is imported.
        const type = widget?.type ?? widget?.id;
        const rebase = REBASES.find((entry) => entry.id === type);

        if (!rebase) {
          return widget;
        }

        const settings = asObject(widget.userSettings) ?? {};

        const onOldDesign =
          widget.designWidth === rebase.from.width &&
          widget.designHeight === rebase.from.height;

        const movedSettings = rebaseSettings(settings, rebase);

        return {
          ...widget,
          ...(onOldDesign
            ? { designWidth: rebase.to.width, designHeight: rebase.to.height }
            : {}),
          userSettings: movedSettings,
        };
      })
    ),
};
