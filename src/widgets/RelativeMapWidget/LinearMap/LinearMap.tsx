import { useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { TRACK_SURFACE_ON_TRACK } from '@utils/widget/widget-utils';
import { CarDot } from '@/components/shared/CarDot/CarDot';

import styles from './LinearMap.module.scss';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const LinearMap = observer(() => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getLinearMapSettings();
  const entries = computed.relativeEntries;
  const player = entries.find((entry) => entry.isPlayer) ?? null;
  const isHorizontal = settings.orientation === 'horizontal';
  const playerDotColor = settings.playerDotColor;
  const targetDotRadiusPx = settings.targetDotRadiusPx ?? 9;
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;

      setSize({ w: width, h: height });
    });

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const sizeClass = isHorizontal
    ? styles.linearMapHorizontal
    : styles.linearMapVertical;

  const dots =
    player && size.w > 0
      ? entries.flatMap((d) => {
          if (d.trackSurface !== TRACK_SURFACE_ON_TRACK && !d.isPlayer)
            return [];

          let diff = d.lapDistPct - player.lapDistPct;

          if (diff < -0.5) diff += 1;

          if (diff > 0.5) diff -= 1;

          const cx = isHorizontal ? (diff + 0.5) * size.w : size.w / 2;
          const cy = isHorizontal ? size.h / 2 : (0.5 - diff) * size.h;

          return [{ d, cx, cy }];
        })
      : [];

  return (
    <div ref={containerRef} className={`${styles.linearMap} ${sizeClass}`}>
      <div
        className={`${styles.mapCenterLine} ${isHorizontal ? styles.mapCenterLineH : styles.mapCenterLineV}`}
      />

      {size.w > 0 && (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className={styles.dotOverlay}>
          {dots.map(({ d, cx, cy }) => (
            <g key={d.carIdx} transform={`translate(${cx}, ${cy})`}>
              <CarDot
                carNumber={d.carNumber}
                carClassColor={d.carClassColor}
                isPlayer={d.isPlayer}
                radius={targetDotRadiusPx}
                playerColor={playerDotColor}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
});
