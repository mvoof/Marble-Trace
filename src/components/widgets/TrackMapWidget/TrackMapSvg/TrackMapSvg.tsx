import { useRef, useState, useEffect } from 'react';
import type { TrackPoint } from '../../../../types/track';
import { getPointAtPct } from '../../../../utils/track-recorder';
import type { Sector } from '../../../../types/bindings';
import type { CarOnTrack } from '../types';
import { CarDot } from '../../primitives';
import { SECTOR_ARC_COLORS } from '../track-map-utils';

import styles from './TrackMapSvg.module.scss';

interface TrackMapSvgProps {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  cars: CarOnTrack[];
  sectors: Sector[] | null | undefined;
  showPing?: boolean;
  sfLabel?: string;
}

export const TrackMapSvg = ({
  svgPath,
  viewBox,
  points,
  cars,
  sectors,
  showPing = true,
  sfLabel = 'S/F',
}: TrackMapSvgProps) => {
  const parts = viewBox.split(' ').map(Number);
  const [vbX, vbY, vbW, vbH] = parts;
  const cx = vbX + vbW / 2;
  const cy = vbY + vbH / 2;

  // Derive a radius that scales with the viewBox so dots look proportional
  const dotRadius = Math.min(vbW, vbH) * 0.035;

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
        transform={`translate(${cx}, ${cy}) scale(-1, 1) translate(${-cx}, ${-cy})`}
      >
        {/* Track border */}
        <path
          d={svgPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="18"
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
          strokeWidth="14"
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
                strokeWidth="4"
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
                <polygon points="-6,-5 8,0 -6,5" fill={color} opacity="0.9" />
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
                  y1="-20"
                  x2="0"
                  y2="20"
                  stroke="white"
                  strokeWidth="5"
                  opacity="0.85"
                />
                <text
                  x="0"
                  y="-25"
                  textAnchor="middle"
                  className={styles.sfLabel}
                >
                  {sfLabel}
                </text>
              </g>
            );
          })()}

        {/* Cars — same CarDot component as LinearMap, radius scaled to viewBox */}
        {points.length > 0 &&
          cars.map((car) => {
            const { x, y } = getPointAtPct(points, car.lapDistPct);
            const isClassLeader = car.classPosition === 1 && !car.isPlayer;
            const showLabel = car.isPlayer || isClassLeader;

            return (
              <g key={car.carIdx} transform={`translate(${x}, ${y})`}>
                <CarDot
                  carNumber={car.carNumber}
                  carClassColor={car.carClassColor}
                  isPlayer={car.isPlayer}
                  radius={dotRadius}
                  showPing={showPing}
                  label={showLabel ? (car.isPlayer ? 'YOU' : 'P1') : undefined}
                  labelIsPlayer={car.isPlayer}
                />
              </g>
            );
          })}
      </g>
    </svg>
  );
};
