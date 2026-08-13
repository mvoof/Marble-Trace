import type { SimType } from '@/types/bindings';

export const getSimDisplayName = (sim: SimType | null): string => {
  if (sim === 'IRacing') {
    return 'iRacing';
  }

  return 'Simulator';
};
