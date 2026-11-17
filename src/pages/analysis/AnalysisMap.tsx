import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import {
  boundsOf,
  headingDegreesAt,
  svgPathOf,
  tangentAt,
  type ProjectedPath,
} from '@features/lap-analysis/map-projection';
import type { ChartViewport } from '@shared/lib/chart-viewport';
import { FinishLine } from '@shared/ui/FinishLine/FinishLine';
import {
  attachMapGestures,
  LABEL_SCALE,
  MARKER_CHEVRON_PATH,
  MARKER_DOT_RADIUS_PX,
  MARKER_STEM_PATH,
  paddedBox,
  type ViewBox,
} from './map-gestures';
import { MapTools } from './AnalysisMapParts';
import styles from './AnalysisMap.module.scss';

/** The track band's width, metres. */
const TRACK_WIDTH_M = 14;
/** Sector ticks reach this far either side of the track, metres. */
const TICK_REACH_M = 16;
/** Sector labels sit this far outside the track, metres. */
const LABEL_OFFSET_M = 38;
const SECTOR_PREFIX = 'S';

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
        <MapTools />

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

          <FinishLine
            x={referencePath.xs[0]}
            y={referencePath.ys[0]}
            headingDeg={headingDegreesAt(referencePath, 0)}
            trackWidth={TRACK_WIDTH_M}
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
                  className={styles.stem}
                  d={MARKER_STEM_PATH}
                  stroke={colors[index]}
                />
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
