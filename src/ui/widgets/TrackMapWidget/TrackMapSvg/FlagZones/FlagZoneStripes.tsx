import { useId } from 'react';
import { observer } from 'mobx-react-lite';

import type { FlagZoneStyle } from '@/types/widget-settings';
import { splitFlagZoneAtStartFinish, type FlagZone } from '@utils/flag-zones';

import styles from './FlagZoneStripes.module.scss';

interface FlagZoneStripesProps {
  zones: FlagZone[];
  svgPath: string;
  pathLength: number;
  strokeWidth: number;
  blink: boolean;
  zoneStyle: FlagZoneStyle;
}

/** Hazard bars, in the yellow the flag widgets already use for a local yellow. */
const BAR_COLOR = '#eab308';
const GAP_COLOR = '#eab308';
const GAP_OPACITY = 0.34;

/** Side of one hazard tile before the 45° rotation, in path units. */
const TILE_SIZE_RATIO = 1.05;
/** How far past the surface the glow spills on each side. */
const GLOW_WIDTH_RATIO = 1.55;
/** Width of one outline rail, as a share of the track surface. */
const OUTLINE_RAIL_RATIO = 0.22;

/**
 * The flag zones drawn onto the track surface: one more `<use>` of the same
 * path, with a hazard `<pattern>` where the sector arcs put a colour. The
 * stripes follow the track's curvature for free, and a car dot — drawn after
 * this layer — is never covered by them.
 */
export const FlagZoneStripes = observer(
  ({
    zones,
    svgPath,
    pathLength,
    strokeWidth,
    blink,
    zoneStyle,
  }: FlagZoneStripesProps) => {
    const uniqueId = useId();
    const patternId = `${uniqueId}-pattern`;
    const maskId = `${uniqueId}-mask`;

    if (zones.length === 0 || pathLength === 0) {
      return null;
    }

    const tileSize = strokeWidth * TILE_SIZE_RATIO;
    const segments = zones.flatMap((zone, zoneIndex) =>
      splitFlagZoneAtStartFinish(zone).map((segment, segmentIndex) => ({
        key: `${zoneIndex}-${segmentIndex}`,
        startDist: segment.startPct * pathLength,
        length: (segment.endPct - segment.startPct) * pathLength,
      }))
    );

    // A zone whose car has recovered is still information — marbles and a slow
    // rejoin outlive the spin — but it stops flashing and steps back.
    const isActive = zones.some((zone) => zone.isActive);
    const layerClass = [
      styles.zoneLayer,
      isActive ? '' : styles.zoneLayerCleared,
      blink && isActive ? styles.zoneLayerBlink : '',
    ]
      .filter(Boolean)
      .join(' ');

    // Outline style keeps the same pattern, colour and opacity and only takes
    // the middle out: a mask paints the full surface width, then knocks the
    // inner part back out, leaving a rail along each edge of the track. Masking
    // rather than covering matters — the sector arc runs underneath, and
    // painting the centre back over would erase its colour.
    const isOutline = zoneStyle === 'outline';
    const innerWidth = strokeWidth * (1 - 2 * OUTLINE_RAIL_RATIO);

    return (
      <g className={layerClass} pointerEvents="none">
        <defs>
          <pattern
            id={patternId}
            width={tileSize}
            height={tileSize}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect
              width={tileSize}
              height={tileSize}
              fill={GAP_COLOR}
              opacity={GAP_OPACITY}
            />
            <rect width={tileSize / 2} height={tileSize} fill={BAR_COLOR} />
            <animateTransform
              attributeName="patternTransform"
              type="translate"
              from="0 0"
              to={`${tileSize} 0`}
              dur="1.6s"
              repeatCount="indefinite"
              additive="sum"
            />
          </pattern>

          {isOutline && (
            <mask id={maskId} maskUnits="userSpaceOnUse">
              {segments.map((segment) => (
                <path
                  key={`show-${segment.key}`}
                  d={svgPath}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`0 ${segment.startDist} ${segment.length} ${pathLength}`}
                />
              ))}

              {segments.map((segment) => (
                <path
                  key={`hide-${segment.key}`}
                  d={svgPath}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={innerWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`0 ${segment.startDist} ${segment.length} ${pathLength}`}
                />
              ))}
            </mask>
          )}
        </defs>

        {/* The glow is an inner wash, so the outline style does without it. */}
        {!isOutline &&
          segments.map((segment) => (
            <path
              key={`glow-${segment.key}`}
              d={svgPath}
              fill="none"
              stroke={BAR_COLOR}
              strokeWidth={strokeWidth * GLOW_WIDTH_RATIO}
              strokeLinecap="butt"
              strokeDasharray={`0 ${segment.startDist} ${segment.length} ${pathLength}`}
              className={styles.zoneGlow}
            />
          ))}

        <g mask={isOutline ? `url(#${maskId})` : undefined}>
          {segments.map((segment) => (
            <path
              key={`surface-${segment.key}`}
              d={svgPath}
              fill="none"
              stroke={`url(#${patternId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={`0 ${segment.startDist} ${segment.length} ${pathLength}`}
              className={styles.zoneSurface}
            />
          ))}
        </g>
      </g>
    );
  }
);
