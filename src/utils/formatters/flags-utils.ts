import type { FlagType } from '@/types';

const SESSION_FLAGS = {
  checkered: 0x00000001,
  blue: 0x00000020,
  black: 0x00010000,
  disqualify: 0x00020000,
  repair: 0x00100000,
  furled: 0x00080000,
} as const;

export const parseDriverFlags = (rawFlags: number): FlagType => {
  if (rawFlags & SESSION_FLAGS.disqualify) return 'dq';
  if (rawFlags & SESSION_FLAGS.repair) return 'meatball';
  if (rawFlags & SESSION_FLAGS.black) return 'penalty';
  if (rawFlags & SESSION_FLAGS.furled) return 'black';
  if (rawFlags & SESSION_FLAGS.blue) return 'blue';
  if (rawFlags & SESSION_FLAGS.checkered) return 'checkered';

  return 'none';
};
