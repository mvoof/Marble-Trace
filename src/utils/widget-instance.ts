import type { WidgetMeta } from '@/types/widget-settings';

/**
 * Which widget a record is a copy of.
 *
 * A layout may hold several copies of the same widget, so a record's `id`
 * identifies the copy, not the widget. The manifest, the component, the shipped
 * defaults and the layout resolver are all found by the *type* — this — while
 * settings, geometry and the enabled flag belong to the copy.
 *
 * The original copy carries no `type` at all and its id doubles as one, which
 * is what lets a settings file written before copies existed read back without
 * a migration. That fallback is the whole reason this is a function rather than
 * a field read: written out by hand it would eventually be written out wrong,
 * and reaching for `widget.id` where a type is meant fails only for a copy —
 * the one case nobody has on screen while writing the line.
 */
export const widgetTypeOf = (widget: Pick<WidgetMeta, 'id' | 'type'>): string =>
  widget.type ?? widget.id;

/**
 * A fresh instance id for a copy of `type`, unique among `takenIds`.
 *
 * Numbered from two, since the copy being made is the second one on screen.
 * The id is never shown and never parsed — it is a key — but a readable one
 * keeps settings.json legible when a user goes looking.
 */
export const nextInstanceId = (
  type: string,
  takenIds: Iterable<string>
): string => {
  const taken = new Set(takenIds);
  let ordinal = 2;

  while (taken.has(`${type}-${ordinal}`)) {
    ordinal++;
  }

  return `${type}-${ordinal}`;
};

/**
 * The widget type an instance id belongs to, for the one caller that has an id
 * and no record: settings looked up for a copy a store has not been handed yet.
 *
 * Copies are named `<type>-<n>` by `nextInstanceId`, so the ordinal comes off
 * again here. An id that is already a type is returned untouched, and a type
 * that genuinely ends in a number is only ever reached when no record for the
 * id exists — the record, when there is one, always answers first.
 */
export const widgetTypeFromId = (id: string): string => id.replace(/-\d+$/, '');
