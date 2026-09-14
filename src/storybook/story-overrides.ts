/**
 * Folds one story argument into a frame override, and only if the story set it.
 *
 * A story that names a scenario leaves most of its arguments undefined, and the
 * meta's `seed` runs *after* that scenario — so a seed writing every argument
 * unconditionally would overwrite the base it was handed. Stating a knob
 * through `whenSet` is what lets one meta serve both: a scenario supplies the
 * frame, and a control turned on top of it states a difference.
 *
 * ```ts
 * const overrides = {
 *   ...whenSet(args.lapsRemaining, (laps) => ({
 *     lapsRemaining: laps,
 *     lapsToFinish: laps,
 *   })),
 * };
 * ```
 */
export const whenSet = <Value, Overrides>(
  value: Value | undefined,
  toOverrides: (value: Value) => Overrides
): Overrides | Record<string, never> => {
  if (value === undefined) {
    return {};
  }

  return toOverrides(value);
};
