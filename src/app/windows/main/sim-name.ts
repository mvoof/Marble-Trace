import type { SimType } from '@shared/contracts/generated/bindings';

export const getSimDisplayName = (sim: SimType | null): string => {
  if (sim === 'IRacing') {
    return 'iRacing';
  }

  return 'Simulator';
};
