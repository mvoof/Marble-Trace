import { useRef, useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import type { TrackPoint } from '@/types';
import { getPointAtPct } from '@widgets/TrackMapWidget/track-map-utils';
import type { SectorEntry } from '@/types/bindings';
import type { TrackMapLeaderLabelMode } from '@/types/widget-settings';
import type { CarOnTrack } from '@widgets/TrackMapWidget/types';
import { CarDot } from '@/components/CarDot/CarDot';
import { shapeForClassOrder } from '@utils/canvas';
import { PaceCarMarker } from './PaceCarMarker/PaceCarMarker';

import { getSectorColor } from '@utils/colors';
import { StartFinishMarker } from './StartFinishMarker/StartFinishMarker';

import styles from './TrackMapSvg.module.scss';

interface TrackMapSvgProps {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  cars: CarOnTrack[];
  sectors: SectorEntry[] | null | undefined;
  sfLabel?: string;
  playerDotColor?: string;
  showPlayerLabel?: boolean;
  leaderLabelMode?: TrackMapLeaderLabelMode;
  trackStrokePx?: number;
  trackBorderPx?: number;
  sectorStrokePx?: number;
  targetDotRadiusPx?: number;
  showStartFinish?: boolean;
  paceCarUseClassColor?: boolean;
  paceCarColor?: string;
  paceCarRadiusPx?: number;
  zoomEnabled?: boolean;
  zoomLevel?: number;
  zoomRotate?: boolean;
  classShapes?: boolean;
  carClassOrder?: Map<number, number>;
}

const MIN_ZOOM_LEVEL = 1;
/** Lap fraction sampled ahead of the player to read the travel direction. */
const HEADING_SAMPLE_PCT = 0.004;
/** Screen "up" in SVG coordinates, where the Y axis grows downwards. */
const SCREEN_UP_DEG = -90;

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
    paceCarUseClassColor = false,
    paceCarColor = '#facc15',
    paceCarRadiusPx = 10,
    zoomEnabled = false,
    zoomLevel = MIN_ZOOM_LEVEL,
    zoomRotate = false,
    classShapes = false,
    carClassOrder,
  }: TrackMapSvgProps) => {
    const playerCar = cars.find((c) => c.isPlayer);
    const playerClassId = playerCar?.carClassId ?? -1;
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

    // Magnifier view: shrink the visible window around the player. Stroke and
    // dot sizes are divided by the same factor so they keep their on-screen
    // size — only the covered track area changes, not the drawing itself.
    const zoomActive =
      zoomEnabled &&
      zoomLevel > MIN_ZOOM_LEVEL &&
      !!playerCar &&
      points.length > 0;

    const playerPoint = zoomActive
      ? getPointAtPct(points, playerCar.lapDistPct)
      : null;

    const effectiveViewBox = (() => {
      if (!playerPoint) return viewBox;

      const zoomedW = vbW / zoomLevel;
      const zoomedH = vbH / zoomLevel;

      return `${playerPoint.x - zoomedW / 2} ${playerPoint.y - zoomedH / 2} ${zoomedW} ${zoomedH}`;
    })();

    // Heading-up mode: the track tangent at the player's position is the travel
    // direction, so rotating the whole drawing until it points up keeps the car
    // fixed and facing forward. Labels counter-rotate to stay readable.
    const screenRotation = (() => {
      if (!playerPoint || !playerCar || !zoomRotate) return 0;

      const aheadPct = (playerCar.lapDistPct + HEADING_SAMPLE_PCT) % 1;
      const ahead = getPointAtPct(points, aheadPct);
      const headingDeg =
        Math.atan2(ahead.y - playerPoint.y, ahead.x - playerPoint.x) *
        (180 / Math.PI);

      return SCREEN_UP_DEG - headingDeg;
    })();

    const contentTransform =
      screenRotation === 0
        ? undefined
        : `rotate(${screenRotation} ${playerPoint?.x} ${playerPoint?.y})`;

    const uprightTransform =
      screenRotation === 0 ? '' : ` rotate(${-screenRotation})`;

    const renderScale = zoomActive ? pixelScale / zoomLevel : pixelScale;
    const dotRadius = targetDotRadiusPx * renderScale;

    const validSectors = sectors
      ?.filter((s) => s.sectorStartPct != null && s.sectorNum != null)
      .sort((a, b) => (a.sectorStartPct ?? 0) - (b.sectorStartPct ?? 0));

    return (
      <svg
        ref={svgRef}
        viewBox={effectiveViewBox}
        className={styles.svgContainer}
      >
        <g transform={contentTransform}>
          {/* Track border */}
          <path
            d={svgPath}
            fill="none"
            stroke="#252525"
            strokeWidth={trackBorderPx * renderScale}
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
            strokeWidth={trackStrokePx * renderScale}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Sector colored arcs */}
          {pathLength > 0 &&
            validSectors?.map((sector, i) => {
              const nextSector = validSectors[i + 1];
              const endPct = nextSector?.sectorStartPct ?? 1.0;

              const startDist = (sector.sectorStartPct ?? 0) * pathLength;
              const sectorLen =
                (endPct - (sector.sectorStartPct ?? 0)) * pathLength;

              return (
                <path
                  key={`arc-${sector.sectorNum}`}
                  d={svgPath}
                  fill="none"
                  strokeWidth={sectorStrokePx * renderScale}
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
                  scale={zoomActive ? 1 / zoomLevel : 1}
                  screenRotation={screenRotation}
                />
              );
            })()}

          {/* Cars — radius scaled to fixed screen pixels via pixelScale */}
          {points.length > 0 &&
            cars.map((car) => {
              const { x, y } = getPointAtPct(points, car.lapDistPct);

              if (car.isPaceCar) {
                const paceColor = paceCarUseClassColor
                  ? car.carClassColor
                  : paceCarColor;

                return (
                  <g
                    key={car.carIdx}
                    transform={`translate(${x}, ${y})${uprightTransform}`}
                  >
                    <PaceCarMarker
                      radius={paceCarRadiusPx * renderScale}
                      color={paceColor}
                    />
                  </g>
                );
              }

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
                <g
                  key={car.carIdx}
                  transform={`translate(${x}, ${y})${uprightTransform}`}
                >
                  <CarDot
                    carNumber={car.carNumber}
                    carClassColor={car.carClassColor}
                    isPlayer={car.isPlayer}
                    shape={
                      classShapes
                        ? shapeForClassOrder(
                            carClassOrder?.get(car.carClassId) ?? -1
                          )
                        : 'circle'
                    }
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
