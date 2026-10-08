import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { TRACK_SURFACE_ON_TRACK } from '@shared/lib/driver';
import { parseClassColor } from '@shared/lib/colors';
import { CarDot } from '@shared/ui/CarDot/CarDot';
import { shapeForClassOrder } from '@shared/lib/canvas';
import { PaceCarMarker } from '@shared/ui/PaceCarMarker/PaceCarMarker';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';

import { FlagBands } from '../FlagBands/FlagBands';

import styles from './LinearMap.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useCarsStore } from '@entities/cars/cars-context';
import { useSessionStore } from '@entities/session/session-context';
import type { LinearMapWidgetSettings } from '../settings-schema';

/** Half the window the strip covers, in lap fraction, either side of the player. */
const WINDOW_HALF = 0.5;

/**
 * The strip of cars around the player. Which cars are drawn changes when someone
 * joins, pits or goes off; where they are drawn changes on every tick — so the
 * dots are markup React renders once per field change, and one pass per
 * animation frame moves them. See `docs/rendering.md`.
 */
export const LinearMap = observer(() => {
  const computed = useBackendComputedStore();
  const carsStore = useCarsStore();
  const sessionStore = useSessionStore();
  const { sessionInfo } = sessionStore;

  const settings = useWidgetSettings<LinearMapWidgetSettings>('relative-map');
  const isHorizontal = settings.orientation === 'horizontal';
  const playerDotColor = settings.playerDotColor;
  const targetDotRadiusPx = settings.targetDotRadiusPx;
  const paceCarUseClassColor = settings.paceCarUseClassColor;
  const paceCarColor = settings.paceCarColor;
  const paceCarRadiusPx = settings.paceCarRadiusPx;
  const paceCarShowInPits = settings.paceCarShowInPits;
  const classShapes = settings.classShapes;
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

  // Identities, not entries: the list only changes when a car joins the strip or
  // leaves it, so React is not asked to rebuild sixty dots a second for the
  // position that moved them.
  const hasPlayer = computed.relativeIdentities.some(
    (identity) => identity.isPlayer
  );

  const dotIdentities = computed.relativeIdentities.filter(
    (identity) =>
      identity.trackSurface === TRACK_SURFACE_ON_TRACK || identity.isPlayer
  );

  const paceCars = (sessionInfo?.cars ?? []).filter((car) => {
    if (!car.isPaceCar) {
      return false;
    }

    const pitPhase = computed.paceCarPhaseOf(car.carIdx);

    return paceCarShowInPits || pitPhase === 'onTrack' || pitPhase === 'pitOut';
  });

  const paceCarIdxs = paceCars.map((car) => car.carIdx).join(',');

  const dotsRef = useReactiveDomWrite<SVGSVGElement>(
    (element, scheduleWrite) => {
      const entries = computed.relativeEntries;
      const playerLapDistPct =
        entries.find((entry) => entry.isPlayer)?.lapDistPct ?? 0;

      const projectLapDistPct = (lapDistPct: number) => {
        let diff = lapDistPct - playerLapDistPct;

        if (diff < -WINDOW_HALF) diff += 1;

        if (diff > WINDOW_HALF) diff -= 1;

        const cx = isHorizontal ? (diff + WINDOW_HALF) * size.w : size.w / 2;
        const cy = isHorizontal ? size.h / 2 : (WINDOW_HALF - diff) * size.h;

        return { cx, cy };
      };

      const lapDistByCarIdx = new Map(
        entries.map((entry) => [entry.carIdx, entry.lapDistPct])
      );

      const transforms = [
        ...dotIdentities.map((identity) =>
          projectLapDistPct(lapDistByCarIdx.get(identity.carIdx) ?? 0)
        ),
        ...paceCars.map((car) =>
          projectLapDistPct(
            // oxlint-disable-next-line no-restricted-properties
            carsStore.carPositions?.car_idx_lap_dist_pct[car.carIdx] ?? -1
          )
        ),
      ];

      const paceCarOnTrack = paceCars.map(
        (car) =>
          // oxlint-disable-next-line no-restricted-properties
          (carsStore.carPositions?.car_idx_lap_dist_pct[car.carIdx] ?? -1) >= 0
      );

      scheduleWrite(() => {
        for (const [dotIndex, { cx, cy }] of transforms.entries()) {
          const dot = element.children[dotIndex];

          if (!(dot instanceof SVGGElement)) {
            continue;
          }

          dot.setAttribute('transform', `translate(${cx}, ${cy})`);

          const paceCarIndex = dotIndex - dotIdentities.length;

          if (paceCarIndex >= 0) {
            // A pace car parked out of the world has no position to draw.
            dot.style.display = paceCarOnTrack[paceCarIndex] ? '' : 'none';
          }
        }
      });
    },
    [
      computed,
      carsStore,
      isHorizontal,
      size.w,
      size.h,
      dotIdentities.length,
      paceCarIdxs,
    ]
  );

  const sizeClass = isHorizontal
    ? styles.linearMapHorizontal
    : styles.linearMapVertical;

  return (
    <div ref={containerRef} className={`${styles.linearMap} ${sizeClass}`}>
      {hasPlayer && <FlagBands isHorizontal={isHorizontal} />}

      <div
        className={`${styles.mapCenterLine} ${isHorizontal ? styles.mapCenterLineH : styles.mapCenterLineV}`}
      />

      {hasPlayer && size.w > 0 && (
        <svg
          ref={dotsRef}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className={styles.dotOverlay}
        >
          {dotIdentities.map((identity) => (
            <g key={identity.carIdx}>
              <CarDot
                carNumber={identity.carNumber}
                carClassColor={identity.carClassColor}
                isPlayer={identity.isPlayer}
                shape={
                  classShapes
                    ? shapeForClassOrder(
                        carClassOrder.get(identity.carClassId) ?? -1
                      )
                    : 'circle'
                }
                radius={targetDotRadiusPx}
                playerColor={playerDotColor}
              />
            </g>
          ))}

          {paceCars.map((car) => (
            <g key={`pace-${car.carIdx}`}>
              <PaceCarMarker
                radius={paceCarRadiusPx}
                color={
                  paceCarUseClassColor
                    ? parseClassColor(car.carClassColor)
                    : paceCarColor
                }
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
});
