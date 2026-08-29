import type { SteeringWheelStyle } from '@/types/widget-settings';

/**
 * The picker's options. Deliberately free of the SVG imports that
 * `WheelArt.tsx` carries, so the settings window lists the wheels without
 * bundling seven silhouettes it never draws.
 */
export interface SteeringWheelStyleOption {
  id: SteeringWheelStyle;
  label: string;
}

export const STEERING_WHEEL_STYLE_OPTIONS: SteeringWheelStyleOption[] = [
  { id: 'default', label: 'Default dial' },
  { id: 'gt-round', label: 'GT round' },
  { id: 'flat-bottom', label: 'Flat bottom' },
  { id: 'bagel', label: 'Bagel' },
  { id: 'formula-open', label: 'Formula open' },
  { id: 'formula-compact', label: 'Formula compact' },
  { id: 'formula-conspit', label: 'Formula wide' },
  { id: 'formula-conspit-pro', label: 'Formula wide pro' },
  { id: 'formula-gt-hybrid', label: 'Formula GT hybrid' },
];
