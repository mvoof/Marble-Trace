import { createStoreContext } from '@utils/store-context';
import type { WidgetHost } from './widget-mount';

/**
 * The core the widgets below render against, as a widget instance needs it —
 * the window's own, or a preview's.
 */
export const [WidgetHostContext, useWidgetHost] =
  createStoreContext<WidgetHost>('WidgetHost');
