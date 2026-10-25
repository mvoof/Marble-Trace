import type { FlagType } from '@shared/contracts/domain';

export const FLAG_LABEL: Record<FlagType, string> = {
  none: '',
  green: 'GREEN',
  yellow: 'YELLOW',
  red: 'RED',
  blue: 'BLUE',
  white: 'LAST LAP',
  checkered: 'CHECKERED',
  black: 'BLACK',
  meatball: 'MEATBALL',
  debris: 'DEBRIS',
  sc: 'PACE CAR',
  dq: 'DISQUALIFIED',
  furled: 'SLOW DOWN',
};
