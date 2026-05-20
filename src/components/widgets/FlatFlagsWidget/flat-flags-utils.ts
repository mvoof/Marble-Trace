import type { FlagType } from '../../../types';

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
};

export const BLINK_FLAGS = new Set<FlagType>(['yellow', 'red']);

export const EMPTY_FLAGS: FlagType[] = [];

export const IS_EMPTY_FLAGS = (flagsList: FlagType[]) => flagsList.length === 0;
