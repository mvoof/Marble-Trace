import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minus, Plus } from 'lucide-react';

import {
  headingDegreesAt,
  type ProjectedPath,
} from '@features/lap-analysis/map-projection';
import styles from './AnalysisMap.module.scss';

const ICON_SIZE = 14;
/** The start/finish line: a checkered bar across the track, metres. */
const FINISH_SQUARE_M = 3;
const FINISH_ROWS = 2;
const FINISH_PATTERN_ID = 'analysis-map-finish';

/**
 * Zoom in, out and the whole lap. The buttons only carry their action:
 * `attachMapGestures` finds them under `data-map-tools` and acts on clicks.
 */
export const MapTools = observer(() => {
  const { t } = useTranslation('main-app');

  return (
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
  );
});

interface FinishLineProps {
  path: ProjectedPath;
  /** How far the bar reaches either side of the track, metres. */
  reachM: number;
}

/** A checkered bar across the track where the lap starts. */
export const FinishLine = observer(({ path, reachM }: FinishLineProps) => (
  <>
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
      y={-reachM}
      width={FINISH_SQUARE_M * FINISH_ROWS}
      height={reachM * 2}
      fill={`url(#${FINISH_PATTERN_ID})`}
      transform={`translate(${path.xs[0]} ${path.ys[0]}) rotate(${headingDegreesAt(path, 0)})`}
    />
  </>
));
