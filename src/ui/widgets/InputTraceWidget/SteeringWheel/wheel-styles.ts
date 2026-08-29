import type { SteeringWheelStyle } from '@/types/widget-settings';

/**
 * The order the picker lists the wheels in. Deliberately free of the SVG
 * imports that `WheelArt.tsx` carries, so the settings window offers every
 * wheel without bundling silhouettes it never draws — and free of labels, so
 * the names live with the rest of the panel's text in the locale files.
 */
export const STEERING_WHEEL_STYLE_IDS: SteeringWheelStyle[] = [
  'default',
  'gt-round',
  'flat-bottom',
  'bagel',
  'formula-open',
  'formula-compact',
  'formula-conspit',
  'formula-conspit-pro',
  'formula-gt-hybrid',
];
