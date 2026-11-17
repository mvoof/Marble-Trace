import { createStoreContext } from '@shared/lib/store-context';
import type { LapAnalysisStore } from './lap-analysis.store';

export const [LapAnalysisContext, useLapAnalysisStore] =
  createStoreContext<LapAnalysisStore>('LapAnalysisStore');
