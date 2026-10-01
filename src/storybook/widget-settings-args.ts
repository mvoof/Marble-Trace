import type { ComponentType } from 'react';
import type { ArgTypes } from '@storybook/react-vite';

import { WIDGET_BY_ID } from '@store/widget-catalog';
import { WIDGET_COMPONENTS } from '@ui/widgets/registry';
import { SETTING_OPTIONS } from './setting-options';

/**
 * Settings a story has nothing to show for: placement and the container's own
 * look belong to WidgetContainer, which a story replaces with its frame.
 */
const FRAME_SETTING_KEYS = new Set([
  'enabled',
  'x',
  'y',
  'currentWidth',
  'currentHeight',
  'opacity',
  'fontScale',
  'backgroundColor',
  'borderColor',
]);

const SETTINGS_CATEGORY = 'Widget settings';

const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\(.*\))$/i;

export const widgetIdOfComponent = (
  component: ComponentType
): string | undefined => {
  const entry = Object.entries(WIDGET_COMPONENTS).find(
    ([, mounted]) => mounted === component
  );

  return entry?.[0];
};

/** The widget's shipped settings a story can drive, as Controls defaults. */
export const settingsDefaultsOf = (
  widgetId: string
): Record<string, unknown> => {
  const manifest = WIDGET_BY_ID.get(widgetId);

  if (!manifest) {
    return {};
  }

  const entries = Object.entries(manifest.userSettings).filter(
    ([key]) => !FRAME_SETTING_KEYS.has(key)
  );

  return Object.fromEntries(entries);
};

const controlFor = (key: string, value: unknown) => {
  const options = SETTING_OPTIONS[key];

  // Matched on the value too: a key two widgets use for different unions only
  // gets the list that holds its own default.
  if (typeof value === 'string' && options?.includes(value)) {
    return { control: { type: 'select' }, options } as const;
  }

  if (typeof value === 'string' && COLOR_PATTERN.test(value)) {
    return { control: { type: 'color' } } as const;
  }

  return {};
};

/**
 * Groups the settings under their own heading in Controls and picks a color
 * picker for color values and a select for the string unions listed in
 * `SETTING_OPTIONS`. Booleans, numbers and objects are left to Storybook's
 * inference.
 */
export const settingsArgTypesOf = (
  defaults: Record<string, unknown>
): ArgTypes => {
  const entries = Object.entries(defaults).map(([key, value]) => {
    return [
      key,
      { table: { category: SETTINGS_CATEGORY }, ...controlFor(key, value) },
    ];
  });

  return Object.fromEntries(entries);
};

export const pickSettings = (
  args: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> => {
  const entries = Object.entries(args).filter(([key]) => key in defaults);

  return Object.fromEntries(entries);
};

export const omitSettings = (
  args: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> => {
  const entries = Object.entries(args).filter(([key]) => !(key in defaults));

  return Object.fromEntries(entries);
};

/** A story's own argTypes refine the generated ones key by key. */
export const mergeArgTypes = (
  generated: ArgTypes,
  own: Partial<ArgTypes> | undefined
): ArgTypes => {
  const merged: ArgTypes = { ...generated };

  Object.entries(own ?? {}).forEach(([key, value]) => {
    merged[key] = { ...generated[key], ...value };
  });

  return merged;
};
