import { useId } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './FinishLine.module.scss';

/** A checker square's side, as a share of the track's width. */
const SQUARE_PER_TRACK_WIDTH = 3 / 14;
/** How far the bar reaches either side of the track's centre line. */
const REACH_PER_TRACK_WIDTH = 16 / 14;
const ROWS = 2;
/** `useId` returns characters a `url(#…)` reference does not take. */
const NON_ID_CHARACTERS = /[^a-zA-Z0-9_-]/g;

interface FinishLineProps {
  /** Where the lap starts, in the map's own units. */
  x: number;
  y: number;
  /** The track's direction there, SVG degrees (from east, clockwise). */
  headingDeg: number;
  /** The track band's width, in the map's own units: the bar scales with it. */
  trackWidth: number;
}

/** The start/finish line: a checkered bar across the track. */
export const FinishLine = observer(
  ({ x, y, headingDeg, trackWidth }: FinishLineProps) => {
    const patternId = `finish-${useId().replace(NON_ID_CHARACTERS, '')}`;
    const square = trackWidth * SQUARE_PER_TRACK_WIDTH;
    const reach = trackWidth * REACH_PER_TRACK_WIDTH;

    return (
      <>
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={square * 2}
            height={square * 2}
          >
            <rect
              className={styles.finishLight}
              width={square * 2}
              height={square * 2}
            />
            <rect
              className={styles.finishDark}
              width={square}
              height={square}
            />
            <rect
              className={styles.finishDark}
              x={square}
              y={square}
              width={square}
              height={square}
            />
          </pattern>
        </defs>

        <rect
          className={styles.finish}
          x={-square}
          y={-reach}
          width={square * ROWS}
          height={reach * 2}
          fill={`url(#${patternId})`}
          transform={`translate(${x} ${y}) rotate(${headingDeg})`}
        />
      </>
    );
  }
);
