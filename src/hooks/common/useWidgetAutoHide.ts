import { use, useEffect } from 'react';

import { WidgetIdContext } from '@app/overlay/components/WidgetContainer/WidgetIdContext';
import { widgetAutoHideStore } from '@store/widget-auto-hide.store';

export const useWidgetAutoHide = (visible: boolean) => {
  const widgetId = use(WidgetIdContext);

  useEffect(() => {
    if (!widgetId) return;

    widgetAutoHideStore.setVisible(widgetId, visible);
  }, [widgetId, visible]);
};
