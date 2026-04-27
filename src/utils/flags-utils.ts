import type { FlagType } from '../types/flags';

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

export const parseSessionFlags = (
  sessionBits: number | null,
  playerCarBits: number | null
): FlagType => {
  const s = sessionBits ?? 0;
  const p = playerCarBits ?? 0;

  if (p & SESSION_FLAGS.black) return 'black';
  if (p & SESSION_FLAGS.disqualify) return 'black';
  if ((p & MEATBALL_MASK) === MEATBALL_MASK) return 'meatball';

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
};

export const parseAllSessionFlags = (
  sessionBits: number | null,
  playerCarBits: number | null
): FlagType[] => {
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
};
