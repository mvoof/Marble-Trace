import {
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const G_METER_DISPLAY_MODE = ['trail', 'fading', 'peak'] as const;
export type GMeterDisplayMode = (typeof G_METER_DISPLAY_MODE)[number];

export const G_METER_COLOR_MODE = ['mono', 'simple', 'advanced'] as const;
export type GMeterColorMode = (typeof G_METER_COLOR_MODE)[number];

export const G_METER_SETTINGS = defineSettings('gMeter', {
  displayMode: choice(G_METER_DISPLAY_MODE, 'fading'),
  /** The G the outer ring stands for. */
  scale: choice([2, 3, 4, 5], 4),
  colorMode: choice(G_METER_COLOR_MODE, 'advanced'),
});

export type GMeterWidgetSettings = SettingsOf<typeof G_METER_SETTINGS.shape>;
