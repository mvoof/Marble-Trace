import type { TrackPoint } from '../../../../utils/track-recorder';
import { getPointAtPct } from '../../../../utils/track-recorder';
import type { Sector } from '../../../../types/bindings';
import type { CarOnTrack } from '../types';

import styles from './TrackMapSvg.module.scss';

interface TrackMapSvgProps {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  cars: CarOnTrack[];
  sectors: Sector[] | null | undefined;
  playerYaw?: number;
}

export const TrackMapSvg = ({
  svgPath,
  viewBox,
  points,
  cars,
  sectors,
  playerYaw,
}: TrackMapSvgProps) => {
  const parts = viewBox.split(' ').map(Number);
  const [vbX, vbY, vbW, vbH] = parts;
  const cx = vbX + vbW / 2;
  const cy = vbY + vbH / 2;
  const rotationDeg =
    playerYaw != null ? playerYaw * (180 / Math.PI) : undefined;

  return (
    <svg viewBox={viewBox} className={styles.svgContainer}>
      <g
        transform={
          rotationDeg != null
            ? `rotate(${rotationDeg}, ${cx}, ${cy})`
            : undefined
        }
      >
        {/* Track border */}
        <path
          d={svgPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Track surface */}
        <path
          d={svgPath}
          fill="none"
          stroke="#0f172a"
          strokeWidth="10"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Sector markers */}
        {points.length > 0 &&
          sectors?.map((sector) => {
            if (sector.SectorStartPct == null || sector.SectorNum == null)
              return null;

            const { x, y } = getPointAtPct(points, sector.SectorStartPct);

            return (
              <g key={sector.SectorNum} transform={`translate(${x}, ${y})`}>
                <circle
                  r="6"
                  fill="rgba(255,255,255,0.15)"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                />
                <text
                  textAnchor="middle"
                  dy="-12"
                  className={styles.sectorLabel}
                >
                  S{sector.SectorNum}
                </text>
              </g>
            );
          })}

        {/* Cars */}
        {points.length > 0 &&
          cars.map((car) => {
            const { x, y } = getPointAtPct(points, car.lapDistPct);
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
      </g>
    </svg>
  );
};
