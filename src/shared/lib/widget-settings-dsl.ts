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

/**
 * The bare name of a file the app keeps beside `settings.json` — never a path:
 * the reader joins it to a directory of its own, so a stored `..\` must not
 * get through.
 */
export type FileNameField = FieldBase<'fileName', string>;

/**
 * The order of a fixed set of names — a table's columns. Every member is in
 * it once; a stored list is brought to that on load (`normalizeOrder`).
 */
export interface OrderField<Member extends string> extends FieldBase<
  'order',
  readonly Member[]
> {
  options: readonly Member[];
}

type PlainField =
  | BoolField
  | OrderField<string>
  | NumberField
  | ChoiceField<string | number>
  | ColorField
  | NumberRecordField
  | FileNameField;

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

export const fileName = (fallback: string, meta: Meta = {}): FileNameField => ({
  kind: 'fileName',
  default: fallback,
  ...meta,
});

export const order = <const Members extends readonly string[]>(
  members: Members,
  meta: Meta = {}
): OrderField<Members[number]> => ({
  kind: 'order',
  default: members,
  options: members,
  ...meta,
});

/**
 * A stored order made whole: names no longer known and repeats dropped, and a
 * member it lacks — one added since it was saved — put right after the member
 * it follows in the shipped order, or first when it leads that order.
 */
export const normalizeOrder = <Member extends string>(
  stored: readonly string[],
  members: readonly Member[]
): Member[] => {
  const known = new Set<string>(members);
  const result = [...new Set(stored)].filter((name): name is Member =>
    known.has(name)
  );

  members.forEach((member, shippedIndex) => {
    if (result.includes(member)) {
      return;
    }

    const shippedBefore = members.slice(0, shippedIndex).reverse();
    const anchor = shippedBefore.find((previous) => result.includes(previous));
    const insertAt = anchor === undefined ? 0 : result.indexOf(anchor) + 1;

    result.splice(insertAt, 0, member);
  });

  return result;
};

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

// Letters, digits, dot, dash and underscore, starting with neither a dot nor a
// dash — no separator, no `..`, nothing a path could be built from.
const FILE_NAME = /^[a-z0-9_][a-z0-9._-]{0,127}$/i;

const isFileName = (value: unknown): boolean =>
  typeof value === 'string' && FILE_NAME.test(value) && !value.includes('..');

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberRecord = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(isFiniteNumber);

const isNameList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((name) => typeof name === 'string');

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
    case 'fileName':
      return isFileName(value);
    case 'order':
      return isNameList(value);
  }
};

const normalize = (field: Field, value: unknown): unknown => {
  if (field.kind === 'number' && isFiniteNumber(value)) {
    return Math.min(field.max, Math.max(field.min, value));
  }

  if (field.kind === 'order' && isNameList(value)) {
    return normalizeOrder(value, field.options);
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
