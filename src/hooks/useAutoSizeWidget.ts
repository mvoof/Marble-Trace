import { useEffect, useRef } from 'react';
import { widgetSettingsStore } from '../store/widget-settings.store';

export const useAutoSizeWidget = (widgetId: string) => {
  const widgetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) widgetSettingsStore.updateAutoSize(widgetId, w, h);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [widgetId]);

  return widgetRef;
};
