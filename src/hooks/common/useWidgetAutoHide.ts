import { useContext, useEffect } from 'react';

import { WidgetIdContext } from '@app/overlay/components/WidgetContainer/WidgetIdContext';
import { widgetAutoHideStore } from '@store/widget-auto-hide.store';

export const useWidgetAutoHide = (visible: boolean) => {
  const widgetId = useContext(WidgetIdContext);

  useEffect(() => {
    if (!widgetId) return;

    widgetAutoHideStore.setVisible(widgetId, visible);
  }, [widgetId, visible]);
};
