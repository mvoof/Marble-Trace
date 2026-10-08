import type { WidgetSettingsSchema } from '@shared/contracts/widget-settings';

/**
 * A widget's settings, described once. Each field yields the type
 * (`SettingsOf`), the shipped value (`defaults`), the check a stored override
 * passes on load (`parseOverrides`), the Storybook select options
 * (`selectOptions`) and what a panel row needs — kind, bounds, label key.
 *
 * Plain data, no React and no i18n: a manifest imports it, so every window —
 * the remote page included — ships it.
 */

interface FieldBase<Kind extends string, Value> {
  kind: Kind;
  default: Value;
  /**
   * Where the panel row reads its title from, when it is not the setting key
   * in the widget's own locale block: a `common.*` key shared by several
   * widgets. The row reads `<label>` and `<label>Desc`.
   */
  label?: string;
}

export type BoolField = FieldBase<'bool', boolean>;

export interface NumberField extends FieldBase<'number', number> {
  min: number;
  max: number;
  step?: number;
}

export interface ChoiceField<Value extends string | number> extends FieldBase<
  'choice',
  Value
> {
  options: readonly Value[];
}

export type ColorField = FieldBase<'color', string>;

/** A map of numbers by name — every value finite, the names free. */
export type NumberRecordField = FieldBase<'numRecord', Record<string, number>>;

type PlainField =
  | BoolField
  | NumberField
  | ChoiceField<string | number>
  | ColorField
  | NumberRecordField;

/** A field whose value may also be `null` — "not set, use what the sim says". */
export type NullableField<Inner extends PlainField> = Omit<Inner, 'default'> & {
  default: Inner['default'] | null;
  nullable: true;
};

type NullableOf<Inner> = Inner extends PlainField
  ? NullableField<Inner>
  : never;

export type Field = PlainField | NullableOf<PlainField>;

type Meta = Pick<FieldBase<string, unknown>, 'label'>;

interface NumberBounds {
  min: number;
  max: number;
  step?: number;
}

export const bool = (fallback: boolean, meta: Meta = {}): BoolField => ({
  kind: 'bool',
  default: fallback,
  ...meta,
});

export const num = (
  fallback: number,
  bounds: NumberBounds,
  meta: Meta = {}
): NumberField => ({ kind: 'number', default: fallback, ...bounds, ...meta });

export const choice = <const Options extends readonly (string | number)[]>(
  options: Options,
  fallback: Options[number],
  meta: Meta = {}
): ChoiceField<Options[number]> => ({
  kind: 'choice',
  default: fallback,
  options,
  ...meta,
});

export const color = (fallback: string, meta: Meta = {}): ColorField => ({
  kind: 'color',
  default: fallback,
  ...meta,
});

export const numRecord = (
  fallback: Record<string, number> = {},
  meta: Meta = {}
): NumberRecordField => ({ kind: 'numRecord', default: fallback, ...meta });

/**
 * `fallback` is the shipped value when it is `null` rather than the inner
 * field's own — "not set" as the default, the inner field still giving the
 * kind and the bounds.
 */
export const nullable = <Inner extends PlainField>(
  field: Inner,
  fallback: Inner['default'] | null = field.default
): NullableField<Inner> => ({
  ...field,
  default: fallback,
  nullable: true,
});

export type SettingsShape = Record<string, Field>;

export type SettingsOf<Shape extends SettingsShape> = {
  -readonly [Key in keyof Shape]: Shape[Key]['default'];
};

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_COLOR = /^(rgba?|hsla?)\([^)]*\)$/i;
const TRANSPARENT = 'transparent';

const isColor = (value: unknown): boolean =>
  typeof value === 'string' &&
  (HEX_COLOR.test(value) ||
    FUNCTIONAL_COLOR.test(value) ||
    value === TRANSPARENT);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberRecord = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(isFiniteNumber);

const isValid = (field: Field, value: unknown): boolean => {
  if (value === null) {
    return 'nullable' in field;
  }

  switch (field.kind) {
    case 'bool':
      return typeof value === 'boolean';
    case 'number':
      return isFiniteNumber(value);
    case 'choice':
      return (field.options as readonly unknown[]).includes(value);
    case 'color':
      return isColor(value);
    case 'numRecord':
      return isNumberRecord(value);
  }
};

const normalize = (field: Field, value: unknown): unknown => {
  if (field.kind === 'number' && isFiniteNumber(value)) {
    return Math.min(field.max, Math.max(field.min, value));
  }

  return value;
};

export interface ParsedOverrides<Settings> {
  overrides: Partial<Settings>;
  /** Keys whose stored value was the wrong type or no longer a member. */
  rejected: string[];
}

export interface SettingsSchema<
  Shape extends SettingsShape,
> extends WidgetSettingsSchema {
  shape: Shape;
  defaults: SettingsOf<Shape>;
  /**
   * Validation on load: an override of the right type survives (a number is
   * clamped into its bounds); anything else falls back to the shipped value.
   * Keys the schema does not know are left out — the widget no longer has
   * them.
   */
  parseOverrides: (
    raw: Record<string, unknown>
  ) => ParsedOverrides<SettingsOf<Shape>>;
}

/**
 * `localeBlock` names the widget's block under `settingsPanels` in
 * `locales/<lang>/widgets.json` — the block a row without a `label` reads its
 * title from, by the setting key. Two widgets that share a schema share it.
 */
export const defineSettings = <const Shape extends SettingsShape>(
  localeBlock: string,
  shape: Shape
): SettingsSchema<Shape> => {
  const entries = Object.entries(shape);

  const defaults = Object.fromEntries(
    entries.map(([key, field]) => [key, field.default])
  ) as SettingsOf<Shape>;

  const selectOptions = Object.fromEntries(
    entries.flatMap(([key, field]) =>
      field.kind === 'choice' ? [[key, field.options]] : []
    )
  );

  const parseOverrides = (raw: Record<string, unknown>) => {
    const overrides: Record<string, unknown> = {};
    const rejected: string[] = [];

    entries.forEach(([key, field]) => {
      if (!(key in raw)) {
        return;
      }

      if (isValid(field, raw[key])) {
        overrides[key] = normalize(field, raw[key]);
      } else {
        rejected.push(key);
      }
    });

    return {
      overrides: overrides as Partial<SettingsOf<Shape>>,
      rejected,
    };
  };

  return { localeBlock, shape, defaults, parseOverrides, selectOptions };
};

/** Whether a field's own shipped value passes the check a stored one must. */
export const isValidDefault = (field: Field): boolean =>
  isValid(field, field.default) &&
  (field.kind !== 'number' ||
    !isFiniteNumber(field.default) ||
    (field.default >= field.min && field.default <= field.max));
