import { use, useEffect } from 'react';

import { WidgetIdContext } from '@app/overlay/components/WidgetContainer/WidgetIdContext';
import { useWidgetAutoHideStore } from '@store/root-store-context';

export const useWidgetAutoHide = (visible: boolean) => {
  const widgetAutoHide = useWidgetAutoHideStore();

  const widgetId = use(WidgetIdContext);

  useEffect(() => {
    if (!widgetId) return;

    widgetAutoHide.setVisible(widgetId, visible);
  }, [widgetId, visible]);
};
