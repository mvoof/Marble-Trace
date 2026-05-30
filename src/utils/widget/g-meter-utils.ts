import type { GMeterColorMode } from '@/types/widget-settings';

export const G_CONSTANT = 9.81;
export const SMOOTHING = 0.12;
export const TRACE_LENGTH = 100;
export const FADING_DECAY = 0.9992;
export const ENVELOPE_SPREAD = 10;
export const RADIUS_RATIO = 0.76;

export const COLOR_TURN = '#3399ff';
const COLOR_BRAKE = '#ef4444';
const COLOR_ACCEL = '#22c55e';
const COLOR_IDLE = '#adadad';

export const computeColor = (
  colorMode: GMeterColorMode,
  latG: number,
  lonG: number,
  dist: number
): string => {
  if (colorMode === 'mono') return COLOR_TURN;

  if (colorMode === 'simple') {
    if (lonG < -0.15) return COLOR_BRAKE;
    if (lonG > 0.15) return COLOR_ACCEL;

    return COLOR_TURN;
  }

  if (dist < 0.1) return COLOR_IDLE;

  const angle = Math.atan2(Math.abs(lonG), Math.abs(latG));
  const wLon = Math.sqrt(angle / (Math.PI / 2));
  const wTurn = 1.0 - wLon;

  if (lonG < 0) {
    // brake (#ef4444 = 239,68,68) → turn (#3399ff = 51,153,255)
    const r = Math.round(239 * wLon + 51 * wTurn);
    const g = Math.round(68 * wLon + 153 * wTurn);
    const b = Math.round(68 * wLon + 255 * wTurn);

    return `rgb(${r},${g},${b})`;
  } else {
    // accel (#22c55e = 34,197,94) → turn (#3399ff = 51,153,255)
    const r = Math.round(34 * wLon + 51 * wTurn);
    const g = Math.round(197 * wLon + 153 * wTurn);
    const b = Math.round(94 * wLon + 255 * wTurn);

    return `rgb(${r},${g},${b})`;
  }
};
