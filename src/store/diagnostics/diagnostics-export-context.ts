import { createStoreContext } from '@utils/store-context';
import type { DiagnosticsExportStore } from './diagnostics-export.store';

export const [DiagnosticsExportContext, useDiagnosticsExportStore] =
  createStoreContext<DiagnosticsExportStore>('DiagnosticsExportStore');
