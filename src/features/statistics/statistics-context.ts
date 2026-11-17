import { createStoreContext } from '@shared/lib/store-context';
import type { StatisticsStore } from './statistics.store';

export const [StatisticsContext, useStatisticsStore] =
  createStoreContext<StatisticsStore>('StatisticsStore');
