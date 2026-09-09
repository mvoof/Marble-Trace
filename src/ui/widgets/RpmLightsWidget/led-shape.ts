import type { CSSProperties } from 'react';

import type { RpmLightsWidgetSettings } from '@/types/widget-settings';

export const LED_COUNT = 22;

export const LED_OFF = 'rgba(255,255,255,0.06)';

/** The custom property one LED's colour is written to. */
export const LED_COLOR_PROPERTY = '--rpm-seg-color';

const CIRCLE_RADIUS = '50%';
const PARALLELOGRAM_RADIUS = '0';
const DEFAULT_RADIUS = '15%';

const PARALLELOGRAM_CLIP = 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)';

/**
 * The shape every LED is cut to. It follows the user's setting and nothing
 * else, so it is applied by React once and never touched by the reactive write
 * that drives the colours.
 */
export const ledShapeStyle = (
  ledShape: RpmLightsWidgetSettings['ledShape']
): CSSProperties => {
  if (ledShape === 'circle') {
    return { borderRadius: CIRCLE_RADIUS };
  }

  if (ledShape === 'parallelogram') {
    return { borderRadius: PARALLELOGRAM_RADIUS, clipPath: PARALLELOGRAM_CLIP };
  }

  return { borderRadius: DEFAULT_RADIUS };
};
