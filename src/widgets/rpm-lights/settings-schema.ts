import {
  choice,
  color,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const LED_SHAPE = ['square', 'circle', 'parallelogram'] as const;
export type LedShape = (typeof LED_SHAPE)[number];

export const RPM_LIGHTS_SETTINGS = defineSettings('rpmLights', {
  rpmColorTheme: choice(['custom', 'gradient', 'classic'], 'custom'),
  rpmColorLow: color('#10b981', { label: 'common.rpmColorLow' }),
  rpmColorMid: color('#eab308', { label: 'common.rpmColorMid' }),
  rpmColorHigh: color('#ef4444', { label: 'common.rpmColorHigh' }),
  rpmColorShift: color('#a855f7', { label: 'common.rpmColorShift' }),
  rpmColorLimit: color('#f97316', { label: 'common.rpmColorLimit' }),
  ledShape: choice(LED_SHAPE, 'square'),
});

export type RpmLightsWidgetSettings = SettingsOf<
  typeof RPM_LIGHTS_SETTINGS.shape
>;
