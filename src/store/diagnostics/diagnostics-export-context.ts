import { createStoreContext } from '@shared/lib/store-context';
import type { DiagnosticsExportStore } from './diagnostics-export.store';

export const [DiagnosticsExportContext, useDiagnosticsExportStore] =
  createStoreContext<DiagnosticsExportStore>('DiagnosticsExportStore');
