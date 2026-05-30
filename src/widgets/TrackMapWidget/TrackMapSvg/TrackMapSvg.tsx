import { useRef, useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import type { TrackPoint } from '@/types';
import { getPointAtPct } from '@utils/telemetry/track-recorder';
import type { Sector } from '@/types/bindings';
import type { TrackMapLeaderLabelMode } from '@/types/widget-settings';
import type { CarOnTrack } from '@widgets/TrackMapWidget/types';
import { CarDot } from '@/components/shared/CarDot/CarDot';

import { getSectorColor } from '@utils/widget/sector-utils';
import { StartFinishMarker } from './StartFinishMarker/StartFinishMarker';

import styles from './TrackMapSvg.module.scss';

interface TrackMapSvgProps {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  cars: CarOnTrack[];
  sectors: Sector[] | null | undefined;
  sfLabel?: string;
  playerDotColor?: string;
  showPlayerLabel?: boolean;
  leaderLabelMode?: TrackMapLeaderLabelMode;
  trackStrokePx?: number;
  trackBorderPx?: number;
  sectorStrokePx?: number;
  targetDotRadiusPx?: number;
  showStartFinish?: boolean;
}

export const TrackMapSvg = observer(
  ({
    svgPath,
    viewBox,
    points,
    cars,
    sectors,
    playerDotColor = '#18181b',
    showPlayerLabel = true,
    leaderLabelMode = 'all',
    trackStrokePx = 10,
    trackBorderPx = 3,
    sectorStrokePx = 6,
    targetDotRadiusPx = 10,
    showStartFinish = true,
  }: TrackMapSvgProps) => {
    const playerClassId = cars.find((c) => c.isPlayer)?.carClassId ?? -1;
    const parts = viewBox.split(' ').map(Number);
    const vbW = parts[2];
    const vbH = parts[3];

    const svgRef = useRef<SVGSVGElement>(null);
    const [pixelScale, setPixelScale] = useState(1);

    useEffect(() => {
      const el = svgRef.current;

      if (!el) return;

      const obs = new ResizeObserver(() => {
        const { width, height } = el.getBoundingClientRect();

        if (width === 0 || height === 0) return;

        const scaleX = vbW / width;
        const scaleY = vbH / height;

        setPixelScale(Math.max(scaleX, scaleY));
      });

      obs.observe(el);

      return () => obs.disconnect();
    }, [vbW, vbH]);

    const dotRadius = targetDotRadiusPx * pixelScale;

    const pathRef = useRef<SVGPathElement>(null);
    const [pathLength, setPathLength] = useState(0);

    useEffect(() => {
      if (pathRef.current) {
        setPathLength(pathRef.current.getTotalLength());
      }
    }, [svgPath]);

    const trackCenter = useMemo(() => {
      if (points.length === 0) return { x: 0, y: 0 };

      let sumX = 0;
      let sumY = 0;

      for (const p of points) {
        sumX += p.x;
        sumY += p.y;
      }

      return {
        x: sumX / points.length,
        y: sumY / points.length,
      };
    }, [points]);

    const validSectors = sectors
      ?.filter((s) => s.SectorStartPct != null && s.SectorNum != null)
      .sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0));

    return (
      <svg ref={svgRef} viewBox={viewBox} className={styles.svgContainer}>
        <g>
          {/* Track border */}
          <path
            d={svgPath}
            fill="none"
            stroke="#252525"
            strokeWidth={trackBorderPx * pixelScale}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Track surface */}
          <path
            ref={pathRef}
            d={svgPath}
            fill="none"
            stroke="#272727"
            strokeWidth={trackStrokePx * pixelScale}
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

              return (
                <path
                  key={`arc-${sector.SectorNum}`}
                  d={svgPath}
                  fill="none"
                  strokeWidth={sectorStrokePx * pixelScale}
                  strokeLinecap="butt"
                  strokeDasharray={`0 ${startDist} ${sectorLen} ${pathLength}`}
                  className={styles.sectorArc}
                  style={{ stroke: getSectorColor(i) }}
                />
              );
            })}

          {/* Start/Finish marker */}
          {showStartFinish &&
            points.length > 0 &&
            (() => {
              const { x, y } = getPointAtPct(points, 0);
              const next = getPointAtPct(points, 0.01);
              const angle =
                Math.atan2(next.y - y, next.x - x) * (180 / Math.PI);

              return (
                <StartFinishMarker
                  x={x}
                  y={y}
                  angle={angle}
                  trackCenterX={trackCenter.x}
                  trackCenterY={trackCenter.y}
                />
              );
            })()}

          {/* Cars — radius scaled to fixed screen pixels via pixelScale */}
          {points.length > 0 &&
            cars.map((car) => {
              const { x, y } = getPointAtPct(points, car.lapDistPct);

              const isClassLeader = car.classPosition === 1 && !car.isPlayer;
              const showLeaderLabel =
                isClassLeader &&
                (leaderLabelMode === 'all' ||
                  (leaderLabelMode === 'own-class' &&
                    car.carClassId === playerClassId));

              const label = car.isPlayer
                ? showPlayerLabel
                  ? 'YOU'
                  : undefined
                : showLeaderLabel
                  ? 'P1'
                  : undefined;

              return (
                <g key={car.carIdx} transform={`translate(${x}, ${y})`}>
                  <CarDot
                    carNumber={car.carNumber}
                    carClassColor={car.carClassColor}
                    isPlayer={car.isPlayer}
                    radius={dotRadius}
                    label={label}
                    labelIsPlayer={car.isPlayer}
                    playerColor={playerDotColor}
                  />
                </g>
              );
            })}
        </g>
      </svg>
    );
  }
);
