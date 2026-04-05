import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives';
import { useCarIdx, useSession } from '../../../hooks/useIracingData';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type { Driver } from '../../../types/bindings';

import styles from './TrackMapWidget.module.scss';

interface CarOnTrack {
  carIdx: number;
  carNumber: string;
  carClassColor: string;
  lapDistPct: number;
  trackSurface: number;
  isPlayer: boolean;
  position: number;
}

const DEFAULT_TRACK_PATH =
  'M 200,450 C 50,450 50,300 150,250 C 250,200 150,150 200,50 C 250,-50 450,50 550,150 C 650,250 750,350 700,450 C 650,550 350,450 200,450';

const SVG_VIEWBOX = '0 0 800 500';

export const TrackMapWidget = observer(() => {
  const carIdx = useCarIdx();
  const { driverInfo } = useSession();
  const settings = widgetSettingsStore.getTrackMapSettings();

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  const cars = useMemo((): CarOnTrack[] => {
    if (!carIdx || drivers.length === 0) return [];

    return drivers
      .filter((d) => {
        const idx = d.CarIdx;
        if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        if (carIdx.car_idx_position[idx] <= 0) return false;
        return true;
      })
      .map((d): CarOnTrack => {
        const idx = d.CarIdx;

        return {
          carIdx: idx,
          carNumber: d.CarNumber,
          carClassColor: d.CarClassColor
            ? `#${d.CarClassColor.replace(/^0x/i, '')}`
            : '#888888',
          lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
          trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
          isPlayer: idx === playerCarIdx,
          position: carIdx.car_idx_position[idx] ?? 0,
        };
      });
  }, [carIdx, drivers, playerCarIdx]);

  const classColors = useMemo(() => {
    const map = new Map<string, string>();

    for (const d of drivers) {
      const name = d.CarClassShortName ?? 'Unknown';

      if (!map.has(name)) {
        map.set(
          name,
          d.CarClassColor
            ? `#${d.CarClassColor.replace(/^0x/i, '')}`
            : '#888888'
        );
      }
    }

    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [drivers]);

  const getPointAtDist = (dist: number) => {
    if (!pathRef.current || pathLength === 0) return { x: 0, y: 0 };

    const point = pathRef.current.getPointAtLength(dist * pathLength);
    return { x: point.x, y: point.y };
  };

  const sfPoint = getPointAtDist(0);

  return (
    <WidgetPanel className={styles.trackMap} gap={0}>
      {settings.showLegend && settings.legendPosition !== 'hidden' && (
        <div
          className={`${styles.legend} ${
            settings.legendPosition === 'right'
              ? styles.legendRight
              : styles.legendLeft
          }`}
        >
          <div className={styles.legendTitle}>Class Legend</div>

          <div className={styles.legendItems}>
            {classColors.map(({ name, color }) => (
              <div
                key={name}
                className={`${styles.legendItem} ${
                  settings.legendPosition === 'right'
                    ? styles.legendItemRight
                    : styles.legendItemLeft
                }`}
              >
                {settings.legendPosition === 'left' && (
                  <div
                    className={styles.legendDot}
                    style={{ backgroundColor: color }}
                  />
                )}

                <span className={styles.legendLabel}>{name}</span>

                {settings.legendPosition === 'right' && (
                  <div
                    className={styles.legendDot}
                    style={{ backgroundColor: color }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <svg viewBox={SVG_VIEWBOX} className={styles.svgContainer}>
        {/* Track border */}
        <path
          d={DEFAULT_TRACK_PATH}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Track surface */}
        <path
          ref={pathRef}
          d={DEFAULT_TRACK_PATH}
          fill="none"
          stroke="#0f172a"
          strokeWidth="10"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Start/Finish line */}
        {pathLength > 0 && (
          <g transform={`translate(${sfPoint.x}, ${sfPoint.y})`}>
            <line
              x1="0"
              y1="-12"
              x2="0"
              y2="12"
              stroke="white"
              strokeWidth="3"
            />
            <text x="0" y="26" textAnchor="middle" className={styles.sfLabel}>
              S/F
            </text>
          </g>
        )}

        {/* Cars */}
        {pathLength > 0 &&
          cars.map((car) => {
            const { x, y } = getPointAtDist(car.lapDistPct);
            const isP1 = car.position === 1;
            const showLabel = car.isPlayer || isP1;

            return (
              <g key={car.carIdx} transform={`translate(${x}, ${y})`}>
                {car.isPlayer && (
                  <circle r="14" fill="white" className={styles.playerPing} />
                )}

                <circle
                  r={car.isPlayer ? 14 : 12}
                  fill="#18181b"
                  stroke={car.carClassColor}
                  strokeWidth="3"
                />

                <text
                  textAnchor="middle"
                  dy="4"
                  className={`${styles.carNumber} ${car.isPlayer ? styles.carNumberLarge : ''}`}
                >
                  {car.carNumber}
                </text>

                {showLabel && (
                  <g transform="translate(0, -25)">
                    <rect
                      x="-25"
                      y="-12"
                      width="50"
                      height="16"
                      rx="4"
                      fill={car.isPlayer ? 'white' : 'rgba(24,24,27,0.9)'}
                      stroke={car.isPlayer ? 'none' : 'rgba(255,255,255,0.15)'}
                      strokeWidth="1"
                    />

                    <text
                      textAnchor="middle"
                      dy="0"
                      className={car.isPlayer ? styles.youTag : styles.p1Tag}
                      fill={car.isPlayer ? 'black' : 'white'}
                    >
                      {car.isPlayer ? 'YOU' : 'P1'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>
    </WidgetPanel>
  );
});
