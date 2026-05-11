import { useEffect, useRef } from 'react';
import { widgetSettingsStore } from '../store/widget-settings.store';

export const useAutoSizeWidget = (widgetId: string) => {
  const widgetRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;

      if (w > 0 && h > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          widgetSettingsStore.updateAutoSize(widgetId, w, h);
        }, 100);
      }
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [widgetId]);

  return widgetRef;
};
