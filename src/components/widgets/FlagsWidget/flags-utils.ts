import type { FlagType } from '../../../types/flags';

const SESSION_FLAGS = {
  checkered: 0x00000001,
  white: 0x00000002,
  green: 0x00000004,
  yellow: 0x00000008,
  red: 0x00000010,
  blue: 0x00000020,
  debris: 0x00000040,
  yellowWaving: 0x00000100,
  caution: 0x00004000,
  cautionWaving: 0x00008000,
  black: 0x00010000,
  disqualify: 0x00020000,
  servicible: 0x00040000,
  repair: 0x00100000,
} as const;

const MEATBALL_MASK = SESSION_FLAGS.servicible | SESSION_FLAGS.repair;

export function parseSessionFlags(
  sessionBits: number | null,
  playerCarBits: number | null
): FlagType {
  const s = sessionBits ?? 0;
  const p = playerCarBits ?? 0;

  // Personal flags from CarIdxSessionFlags take highest priority
  if (p & SESSION_FLAGS.black) return 'black';
  if (p & SESSION_FLAGS.disqualify) return 'black';
  if ((p & MEATBALL_MASK) === MEATBALL_MASK) return 'meatball';

  // Global session flags
  if (s & SESSION_FLAGS.red) return 'red';
  if ((s & MEATBALL_MASK) === MEATBALL_MASK) return 'meatball';
  if (s & SESSION_FLAGS.checkered) return 'checkered';
  if (s & SESSION_FLAGS.white) return 'white';
  if (
    s & SESSION_FLAGS.yellow ||
    s & SESSION_FLAGS.caution ||
    s & SESSION_FLAGS.cautionWaving ||
    s & SESSION_FLAGS.yellowWaving
  ) {
    return 'yellow';
  }
  if (s & SESSION_FLAGS.blue) return 'blue';
  if (s & SESSION_FLAGS.debris) return 'debris';
  if (s & SESSION_FLAGS.green) return 'green';

  return 'none';
}

export function parseAllSessionFlags(
  sessionBits: number | null,
  playerCarBits: number | null
): FlagType[] {
  const s = sessionBits ?? 0;
  const p = playerCarBits ?? 0;
  const flags: FlagType[] = [];

  if (p & SESSION_FLAGS.black || p & SESSION_FLAGS.disqualify)
    flags.push('black');
  if ((p & MEATBALL_MASK) === MEATBALL_MASK) flags.push('meatball');

  if (s & SESSION_FLAGS.red) flags.push('red');
  if (s & SESSION_FLAGS.checkered) flags.push('checkered');
  if (s & SESSION_FLAGS.white) flags.push('white');
  if (
    s & SESSION_FLAGS.yellow ||
    s & SESSION_FLAGS.caution ||
    s & SESSION_FLAGS.cautionWaving ||
    s & SESSION_FLAGS.yellowWaving
  ) {
    flags.push('yellow');
  }
  if (s & SESSION_FLAGS.blue) flags.push('blue');
  if (s & SESSION_FLAGS.debris) flags.push('debris');
  if (s & SESSION_FLAGS.green) flags.push('green');

  return flags;
}

export function isVisible(
  x: number,
  y: number,
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number
): boolean {
  const w = blocksX * 6;
  const h = blocksY * 6;

  if (x < 0 || x >= w || y < 0 || y >= h) return false;

  if (
    (x === 0 && y === 0) ||
    (x === w - 1 && y === 0) ||
    (x === 0 && y === h - 1) ||
    (x === w - 1 && y === h - 1)
  ) {
    return false;
  }

  if (cutW > 0 && cutH > 0) {
    const bx = Math.floor(x / 6);
    const by = Math.floor(y / 6);
    const startBx = Math.floor((blocksX - cutW) / 2);
    const endBx = startBx + cutW;

    if (bx >= startBx && bx < endBx && by < cutH) return false;
  }

  return true;
}

export function isEdge(
  x: number,
  y: number,
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number
): boolean {
  if (!isVisible(x, y, blocksX, blocksY, cutW, cutH)) return false;
  return (
    !isVisible(x - 1, y, blocksX, blocksY, cutW, cutH) ||
    !isVisible(x + 1, y, blocksX, blocksY, cutW, cutH) ||
    !isVisible(x, y - 1, blocksX, blocksY, cutW, cutH) ||
    !isVisible(x, y + 1, blocksX, blocksY, cutW, cutH)
  );
}

interface MeatballCenters {
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  radiusSq: number;
}

export function computeMeatballCenters(
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number
): MeatballCenters {
  const w = blocksX * 6;
  const h = blocksY * 6;

  let cx1 = w / 2 - 0.5;
  let cy1 = h / 2 - 0.5;
  let cx2 = cx1;
  let cy2 = cy1;
  let radiusSq = 6.5 * 6.5;

  const isSplit = cutH >= blocksY && cutW > 0;

  if (isSplit) {
    const leftW = Math.floor((blocksX - cutW) / 2) * 6;
    const rightW = Math.ceil((blocksX - cutW) / 2) * 6;
    if (leftW > 0) cx1 = leftW / 2 - 0.5;
    if (rightW > 0) cx2 = w - rightW / 2 - 0.5;
    cy1 = h / 2 - 0.5;
    cy2 = cy1;
    radiusSq = Math.max(4, Math.pow(Math.min(6.5, leftW / 2 - 1.5), 2));
  } else if (cutH > 0) {
    cy1 = (cutH * 6 + h) / 2 - 0.5;
    cy2 = cy1;
    const bridgeH = h - cutH * 6;
    radiusSq = Math.max(4, Math.pow(Math.min(6.5, bridgeH / 2 - 1.5), 2));
  }

  return { cx1, cy1, cx2, cy2, radiusSq };
}
