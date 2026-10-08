import type { FlagType } from '@shared/contracts/domain';

export const FLAG_LABEL: Record<FlagType, string> = {
  none: '',
  green: 'GREEN FLAG',
  yellow: 'YELLOW FLAG',
  red: 'RED FLAG',
  blue: 'BLUE FLAG',
  white: 'LAST LAP',
  checkered: 'CHECKERED',
  black: 'BLACK FLAG',
  meatball: 'MEATBALL',
  debris: 'DEBRIS',
  penalty: 'PENALTY',
  sc: 'PACE CAR',
  dq: 'DISQUALIFIED',
  furled: 'SLOW DOWN',
};

export const BLINK_FLAGS = new Set<FlagType>(['yellow', 'red']);
