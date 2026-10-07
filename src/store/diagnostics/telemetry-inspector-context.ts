import { createStoreContext } from '@shared/lib/store-context';
import type { TelemetryInspectorStore } from './telemetry-inspector.store';

export const [TelemetryInspectorContext, useTelemetryInspectorStore] =
  createStoreContext<TelemetryInspectorStore>('TelemetryInspectorStore');
