import {
  bool,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const BATTERY_SETTINGS = defineSettings('battery', {
  /** The deploy-mode strip. Hidden anyway on a car whose selector never moves. */
  showDeployMode: bool(true),
  /** MGU-K power, with the deploy/regen state beside it. */
  showPower: bool(true),
  /** Energy sent to the MGU-K this lap. A debrief number, not read at the apex. */
  showLapDeploy: bool(false),
  /** Strip the widget down to the charge bar and its percentage, nothing else. */
  compactMode: bool(false),
});

export type BatteryWidgetSettings = SettingsOf<typeof BATTERY_SETTINGS.shape>;
