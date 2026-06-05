import type { GMeterColorMode } from '@/types/widget-settings';

export const G_CONSTANT = 9.81;
export const SMOOTHING = 0.12;
export const TRACE_LENGTH = 100;
export const FADING_DECAY = 0.9992;
export const ENVELOPE_SPREAD = 10;
export const RADIUS_RATIO = 0.76;

export const COLOR_TURN = '#81b3e4';
const COLOR_BRAKE = '#e48181';
const COLOR_ACCEL = '#81e4aa';
const COLOR_IDLE = '#b0b0b8';

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
    // brake (#e48181 = 228,129,129) → turn (#81b3e4 = 129,179,228)
    const r = Math.round(228 * wLon + 129 * wTurn);
    const g = Math.round(129 * wLon + 179 * wTurn);
    const b = Math.round(129 * wLon + 228 * wTurn);

    return `rgb(${r},${g},${b})`;
  } else {
    // accel (#81e4aa = 129,228,170) → turn (#81b3e4 = 129,179,228)
    const r = Math.round(129 * wLon + 129 * wTurn);
    const g = Math.round(228 * wLon + 179 * wTurn);
    const b = Math.round(170 * wLon + 228 * wTurn);

    return `rgb(${r},${g},${b})`;
  }
};
