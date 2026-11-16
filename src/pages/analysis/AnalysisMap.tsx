import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minus, Plus } from 'lucide-react';

import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import {
  boundsOf,
  headingDegreesAt,
  svgPathOf,
  tangentAt,
  type ProjectedPath,
} from '@features/lap-analysis/map-projection';
import type { ChartViewport } from '@shared/lib/chart-viewport';
import {
  attachMapGestures,
  LABEL_SCALE,
  MARKER_CHEVRON_PATH,
  MARKER_DOT_RADIUS_PX,
  paddedBox,
  type ViewBox,
} from './map-gestures';
import styles from './AnalysisMap.module.scss';

const ICON_SIZE = 14;
/** The track band's width, metres. */
const TRACK_WIDTH_M = 14;
/** Sector ticks reach this far either side of the track, metres. */
const TICK_REACH_M = 16;
/** Sector labels sit this far outside the track, metres. */
const LABEL_OFFSET_M = 38;
const SECTOR_PREFIX = 'S';
/** The start/finish line: a checkered bar across the track, metres. */
const FINISH_SQUARE_M = 3;
const FINISH_ROWS = 2;
const FINISH_REACH_M = TICK_REACH_M;
const FINISH_PATTERN_ID = 'analysis-map-finish';

/** The direction across the track at `index`: the normal of its tangent. */
const normalAt = (path: ProjectedPath, index: number): [number, number] => {
  const [dx, dy] = tangentAt(path, index);

  return [-dy, dx];
};

interface MapViewProps {
  paths: (ProjectedPath | null)[];
  reference: number;
  colors: string[];
  visible: boolean[];
  sectorStartsM: number[];
  viewport: ChartViewport;
}

/**
 * The laps on the map, over a grey band of the reference lap. The view box,
 * the bright stretch and the cursor markers are written straight to the SVG
 * by `attachMapGestures`: gestures and hover render nothing in React.
 */
const MapView = observer(
  ({
    paths,
    reference,
    colors,
    visible,
    sectorStartsM,
    viewport,
  }: MapViewProps) => {
    const { t } = useTranslation('main-app');
    const svgRef = useRef<SVGSVGElement>(null);
    const brightRefs = useRef<(SVGPathElement | null)[]>([]);
    const markerRefs = useRef<(SVGGElement | null)[]>([]);
    const labelRefs = useRef<(SVGTextElement | null)[]>([]);
    const selectRef = useRef<SVGRectElement>(null);
    const referencePath = paths[reference];
    const fullBounds = referencePath ? boundsOf(referencePath) : null;
    const box = useRef<ViewBox | null>(
      fullBounds ? paddedBox(fullBounds) : null
    );

    useEffect(() => {
      const svg = svgRef.current;

      if (svg === null || referencePath === null || fullBounds === null) {
        return;
      }

      return attachMapGestures({
        elements: {
          svg,
          tools: svg.parentElement?.querySelector('[data-map-tools]') ?? null,
          brights: brightRefs.current,
          markers: markerRefs.current,
          labels: labelRefs.current,
          select: selectRef.current,
        },
        paths,
        referencePath,
        fullBounds,
        viewport,
        box,
      });
      // The SVG is rebuilt with new paths; colours and eyes only restyle it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paths, referencePath, viewport]);

    if (referencePath === null || fullBounds === null) {
      return null;
    }

    const sectorTicks = sectorStartsM.map((startM, index) => {
      const point = Math.min(Math.round(startM), referencePath.xs.length - 1);
      const [normalX, normalY] = normalAt(referencePath, point);
      const x = referencePath.xs[point];
      const y = referencePath.ys[point];

      return { index, x, y, normalX, normalY };
    });
    const startBox = box.current ?? paddedBox(fullBounds);
    // The reference lap's marker is drawn last, over the others.
    const markerOrder = [
      ...paths
        .map((_path, index) => index)
        .filter((index) => index !== reference),
      reference,
    ];

    return (
      <div className={styles.map}>
        <div className={styles.tools} data-map-tools>
          <button
            type="button"
            data-map-action="in"
            title={t('dataPage.analysis.zoomIn')}
          >
            <Plus size={ICON_SIZE} />
          </button>
          <button
            type="button"
            data-map-action="out"
            title={t('dataPage.analysis.zoomOut')}
          >
            <Minus size={ICON_SIZE} />
          </button>
          <button
            type="button"
            data-map-action="fit"
            title={t('dataPage.analysis.wholeLap')}
          >
            <Maximize2 size={ICON_SIZE} />
          </button>
        </div>

        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`${startBox.x} ${startBox.y} ${startBox.width} ${startBox.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{t('dataPage.analysis.map')}</title>

          <path
            className={styles.band}
            d={svgPathOf(referencePath)}
            strokeWidth={TRACK_WIDTH_M}
          />

          {sectorTicks.map(({ index, x, y, normalX, normalY }) => (
            <g key={index}>
              {index > 0 && (
                <line
                  className={styles.tick}
                  x1={x - normalX * TICK_REACH_M}
                  y1={y - normalY * TICK_REACH_M}
                  x2={x + normalX * TICK_REACH_M}
                  y2={y + normalY * TICK_REACH_M}
                />
              )}
              <text
                ref={(element) => {
                  labelRefs.current[index] = element;
                }}
                className={styles.label}
                x={x + normalX * LABEL_OFFSET_M}
                y={y + normalY * LABEL_OFFSET_M}
                fontSize={startBox.width * LABEL_SCALE}
              >
                {`${SECTOR_PREFIX}${index + 1}`}
              </text>
            </g>
          ))}

          {paths.map((path, index) =>
            path === null || !visible[index] ? null : (
              <path
                key={`faint-${index}`}
                className={styles.faint}
                d={svgPathOf(path)}
                stroke={colors[index]}
              />
            )
          )}

          {paths.map((path, index) =>
            path === null || !visible[index] ? null : (
              <path
                key={`bright-${index}`}
                ref={(element) => {
                  brightRefs.current[index] = element;
                }}
                className={styles.bright}
                d={
                  viewport.range === null
                    ? svgPathOf(path)
                    : svgPathOf(
                        path,
                        Math.floor(viewport.range[0]),
                        Math.ceil(viewport.range[1])
                      )
                }
                stroke={colors[index]}
              />
            )
          )}

          <defs>
            <pattern
              id={FINISH_PATTERN_ID}
              patternUnits="userSpaceOnUse"
              width={FINISH_SQUARE_M * 2}
              height={FINISH_SQUARE_M * 2}
            >
              <rect
                className={styles.finishLight}
                width={FINISH_SQUARE_M * 2}
                height={FINISH_SQUARE_M * 2}
              />
              <rect
                className={styles.finishDark}
                width={FINISH_SQUARE_M}
                height={FINISH_SQUARE_M}
              />
              <rect
                className={styles.finishDark}
                x={FINISH_SQUARE_M}
                y={FINISH_SQUARE_M}
                width={FINISH_SQUARE_M}
                height={FINISH_SQUARE_M}
              />
            </pattern>
          </defs>

          <rect
            className={styles.finish}
            x={-FINISH_SQUARE_M}
            y={-FINISH_REACH_M}
            width={FINISH_SQUARE_M * FINISH_ROWS}
            height={FINISH_REACH_M * 2}
            fill={`url(#${FINISH_PATTERN_ID})`}
            transform={`translate(${referencePath.xs[0]} ${referencePath.ys[0]}) rotate(${headingDegreesAt(referencePath, 0)})`}
          />

          {markerOrder.map((index) =>
            paths[index] === null || !visible[index] ? null : (
              <g
                key={`marker-${index}`}
                ref={(element) => {
                  markerRefs.current[index] = element;
                }}
                visibility="hidden"
              >
                <path
                  className={styles.chevron}
                  d={MARKER_CHEVRON_PATH}
                  stroke={colors[index]}
                />
                <circle
                  className={styles.dot}
                  r={MARKER_DOT_RADIUS_PX}
                  fill={colors[index]}
                />
              </g>
            )
          )}

          <rect ref={selectRef} className={styles.select} visibility="hidden" />
        </svg>
      </div>
    );
  }
);

/** The mini map under the lap list. */
export const AnalysisMap = observer(() => {
  const analysis = useLapAnalysisStore();
  const map = analysis.mapPaths;

  if (map === null) {
    return null;
  }

  return (
    <MapView
      paths={map.laps}
      reference={map.reference}
      colors={analysis.laps.map((lap) => lap.color)}
      visible={analysis.laps.map((lap) => lap.visible)}
      sectorStartsM={analysis.sectorStartsM}
      viewport={analysis.viewport}
    />
  );
});
