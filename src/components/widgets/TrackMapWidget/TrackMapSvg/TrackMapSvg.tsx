import { useRef, useState, useEffect } from 'react';
import type { TrackPoint } from '../../../../utils/track-recorder';
import { getPointAtPct } from '../../../../utils/track-recorder';
import type { Sector } from '../../../../types/bindings';
import type { CarOnTrack } from '../types';

import { SECTOR_ARC_COLORS } from '../track-map-utils';

import styles from './TrackMapSvg.module.scss';

interface TrackMapSvgProps {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  cars: CarOnTrack[];
  sectors: Sector[] | null | undefined;
  playerYaw?: number;
  sfLabel?: string;
}

export const TrackMapSvg = ({
  svgPath,
  viewBox,
  points,
  cars,
  sectors,
  playerYaw,
  sfLabel = 'S/F',
}: TrackMapSvgProps) => {
  const parts = viewBox.split(' ').map(Number);
  const [vbX, vbY, vbW, vbH] = parts;
  const cx = vbX + vbW / 2;
  const cy = vbY + vbH / 2;
  const rotationDeg =
    playerYaw != null ? -playerYaw * (180 / Math.PI) : undefined;

  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [svgPath]);

  const validSectors = sectors?.filter(
    (s) => s.SectorStartPct != null && s.SectorNum != null
  );

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
          ref={pathRef}
          d={svgPath}
          fill="none"
          stroke="#0f172a"
          strokeWidth="10"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Sector colored arcs */}
        {pathLength > 0 &&
          validSectors?.map((sector, i) => {
            const nextSector = validSectors[i + 1];
            const endPct = nextSector?.SectorStartPct ?? 1.0;
            const startDist = (sector.SectorStartPct ?? 0) * pathLength;
            const sectorLen =
              (endPct - (sector.SectorStartPct ?? 0)) * pathLength;
            const color = SECTOR_ARC_COLORS[i % SECTOR_ARC_COLORS.length];

            return (
              <path
                key={`arc-${sector.SectorNum}`}
                d={svgPath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="butt"
                strokeDasharray={`0 ${startDist} ${sectorLen} ${pathLength}`}
                className={styles.sectorArc}
              />
            );
          })}

        {/* Sector direction arrows */}
        {points.length > 0 &&
          validSectors?.map((sector, i) => {
            const pct = sector.SectorStartPct ?? 0;
            const color = SECTOR_ARC_COLORS[i % SECTOR_ARC_COLORS.length];
            const { x, y } = getPointAtPct(points, pct);
            const next = getPointAtPct(points, Math.min(pct + 0.01, 0.999));
            const angle = Math.atan2(next.y - y, next.x - x) * (180 / Math.PI);

            return (
              <g
                key={`arrow-${sector.SectorNum}`}
                transform={`translate(${x},${y}) rotate(${angle})`}
              >
                <polygon points="-5,-4 6,0 -5,4" fill={color} opacity="0.9" />
              </g>
            );
          })}

        {/* Start/Finish marker */}
        {points.length > 0 &&
          (() => {
            const { x, y } = getPointAtPct(points, 0);
            const next = getPointAtPct(points, 0.01);
            const angle = Math.atan2(next.y - y, next.x - x) * (180 / Math.PI);
            return (
              <g transform={`translate(${x},${y}) rotate(${angle})`}>
                <line
                  x1="0"
                  y1="-14"
                  x2="0"
                  y2="14"
                  stroke="white"
                  strokeWidth="3"
                  opacity="0.85"
                />
                <text
                  x="0"
                  y="-18"
                  textAnchor="middle"
                  className={styles.sfLabel}
                >
                  {sfLabel}
                </text>
              </g>
            );
          })()}

        {/* Cars */}
        {points.length > 0 &&
          cars.map((car) => {
            const { x, y } = getPointAtPct(points, car.lapDistPct);
            const isClassLeader = car.classPosition === 1 && !car.isPlayer;
            const showLabel = car.isPlayer || isClassLeader;

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
