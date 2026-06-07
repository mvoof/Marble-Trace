import type { GMeterColorMode } from '@/types/widget-settings';

export const G_CONSTANT = 9.81;
export const SMOOTHING = 0.12;
export const TRACE_LENGTH = 100;
export const FADING_DECAY = 0.9992;
export const ENVELOPE_SPREAD = 10;
export const RADIUS_RATIO = 0.76;

export const COLOR_TURN = '#3b82f6';
const COLOR_BRAKE = '#ef4444';
const COLOR_ACCEL = '#10b981';
const COLOR_IDLE = '#9ca3af';

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
    // brake (#ef4444 = 239,68,68) → turn (#3b82f6 = 59,130,246)
    const r = Math.round(239 * wLon + 59 * wTurn);
    const g = Math.round(68 * wLon + 130 * wTurn);
    const b = Math.round(68 * wLon + 246 * wTurn);

    return `rgb(${r},${g},${b})`;
  } else {
    // accel (#10b981 = 16,185,129) → turn (#3b82f6 = 59,130,246)
    const r = Math.round(16 * wLon + 59 * wTurn);
    const g = Math.round(185 * wLon + 130 * wTurn);
    const b = Math.round(129 * wLon + 246 * wTurn);

    return `rgb(${r},${g},${b})`;
  }
};
