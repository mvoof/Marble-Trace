import { createStoreContext } from '@utils/store-context';
import type { FpsDiagnosticsStore } from './fps-diagnostics.store';

export const [FpsDiagnosticsContext, useFpsDiagnosticsStore] =
  createStoreContext<FpsDiagnosticsStore>('FpsDiagnosticsStore');
