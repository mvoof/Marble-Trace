/**
 * A fresh instance id for another instance of `type`, unique among `takenIds`.
 *
 * Numbered from two, since the instance being made is at least the second one
 * in the layout. The id is never shown and never parsed — it is a key — but a
 * readable one keeps settings.json legible when a user goes looking.
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
 * and no record: settings looked up for an instance a store has not been handed
 * yet.
 *
 * Instances are named `<type>-<n>` by `nextInstanceId`, so the ordinal comes
 * off again here. An id that is already a type is returned untouched, and a
 * type that genuinely ends in a number is only ever reached when no record for
 * the id exists — the record, when there is one, always answers first.
 */
export const widgetTypeFromId = (id: string): string => id.replace(/-\d+$/, '');
