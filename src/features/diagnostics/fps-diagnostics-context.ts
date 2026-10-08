import { createStoreContext } from '@shared/lib/store-context';
import type { FpsDiagnosticsStore } from './fps-diagnostics.store';

export const [FpsDiagnosticsContext, useFpsDiagnosticsStore] =
  createStoreContext<FpsDiagnosticsStore>('FpsDiagnosticsStore');
