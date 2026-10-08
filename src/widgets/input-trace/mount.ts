import type { WidgetMount } from '@widgets/widget-mount';
import { INPUT_TRACE_MANIFEST } from './manifest';
import { InputTraceWidget } from './InputTraceWidget';
import { InputTraceWidgetStore } from './input-trace.store';

export const mount: WidgetMount = {
  id: INPUT_TRACE_MANIFEST.id,
  component: InputTraceWidget,
  store: (context) => new InputTraceWidgetStore(context),
};
