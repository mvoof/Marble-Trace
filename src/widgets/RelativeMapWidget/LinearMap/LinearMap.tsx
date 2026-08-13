import { useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { TRACK_SURFACE_ON_TRACK } from '@utils/driver';
import { parseClassColor } from '@utils/colors';
import { CarDot } from '@ui/shared/CarDot/CarDot';
import { shapeForClassOrder } from '@utils/canvas';
import { PaceCarMarker } from '@ui/widgets/TrackMapWidget/TrackMapSvg/PaceCarMarker/PaceCarMarker';

import styles from './LinearMap.module.scss';
import type { LinearMapWidgetSettings } from '@/types/widget-settings';
import {
  useBackendComputedStore,
  useCarsStore,
  usePaceCarStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const LinearMap = observer(() => {
  const computed = useBackendComputedStore();
  const { carPositions } = useCarsStore();
  const sessionStore = useSessionStore();
  const { sessionInfo } = sessionStore;
  const widgetSettings = useWidgetSettingsStore();
  const paceCarStore = usePaceCarStore();

  const settings =
    widgetSettings.getSettings<LinearMapWidgetSettings>('relative-map');
  const entries = computed.relativeEntries;
  const player = entries.find((entry) => entry.isPlayer) ?? null;
  const isHorizontal = settings.orientation === 'horizontal';
  const playerDotColor = settings.playerDotColor;
  const targetDotRadiusPx = settings.targetDotRadiusPx ?? 9;
  const paceCarUseClassColor = settings.paceCarUseClassColor ?? false;
  const paceCarColor = settings.paceCarColor ?? '#facc15';
  const paceCarRadiusPx = settings.paceCarRadiusPx ?? targetDotRadiusPx;
  const paceCarShowInPits = settings.paceCarShowInPits ?? false;
  const classShapes = settings.classShapes ?? false;
  const carClassOrder = sessionStore.carClassOrder;
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

  const projectLapDistPct = (lapDistPct: number) => {
    let diff = lapDistPct - (player?.lapDistPct ?? 0);

    if (diff < -0.5) diff += 1;

    if (diff > 0.5) diff -= 1;

    const cx = isHorizontal ? (diff + 0.5) * size.w : size.w / 2;
    const cy = isHorizontal ? size.h / 2 : (0.5 - diff) * size.h;

    return { cx, cy };
  };

  const dots =
    player && size.w > 0
      ? entries.flatMap((d) => {
          if (d.trackSurface !== TRACK_SURFACE_ON_TRACK && !d.isPlayer)
            return [];

          return [{ d, ...projectLapDistPct(d.lapDistPct) }];
        })
      : [];

  const paceCarDots =
    player && size.w > 0
      ? (sessionInfo?.cars ?? []).flatMap((car) => {
          if (!car.isPaceCar) return [];

          const lapDistPct =
            carPositions?.car_idx_lap_dist_pct[car.carIdx] ?? -1;

          if (lapDistPct < 0) return [];

          const pitPhase = paceCarStore.getPitPhase(car.carIdx);

          if (
            !paceCarShowInPits &&
            pitPhase !== 'onTrack' &&
            pitPhase !== 'pitOut'
          ) {
            return [];
          }

          return [
            {
              carIdx: car.carIdx,
              carClassColor: parseClassColor(car.carClassColor),
              ...projectLapDistPct(lapDistPct),
            },
          ];
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
                shape={
                  classShapes
                    ? shapeForClassOrder(carClassOrder.get(d.carClassId) ?? -1)
                    : 'circle'
                }
                radius={targetDotRadiusPx}
                playerColor={playerDotColor}
              />
            </g>
          ))}

          {paceCarDots.map(({ carIdx, carClassColor, cx, cy }) => (
            <g key={carIdx} transform={`translate(${cx}, ${cy})`}>
              <PaceCarMarker
                radius={paceCarRadiusPx}
                color={paceCarUseClassColor ? carClassColor : paceCarColor}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
});
