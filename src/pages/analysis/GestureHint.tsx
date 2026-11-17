import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import type { ChartGesture, ChartViewport } from '@shared/lib/chart-viewport';
import styles from './AnalysisCharts.module.scss';

const GESTURES: (ChartGesture | 'whole')[] = ['zoom', 'pan', 'frame', 'whole'];

/**
 * The gestures of the charts and the map, the one in force lit. It follows
 * the viewport's gesture straight in the DOM: hovering renders nothing.
 */
export const GestureHint = observer(
  ({ viewport }: { viewport: ChartViewport }) => {
    const { t } = useTranslation('main-app');
    const hintRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
      const light = (gesture: ChartGesture | null) => {
        hintRef.current
          ?.querySelectorAll<HTMLElement>('[data-gesture]')
          .forEach((item) => {
            item.classList.toggle(styles.lit, item.dataset.gesture === gesture);
          });
      };

      light(viewport.gesture);

      return viewport.onGesture(light);
    }, [viewport]);

    return (
      <span ref={hintRef} className={styles.hint}>
        {GESTURES.map((gesture) => (
          <b key={gesture} data-gesture={gesture}>
            {t(`dataPage.analysis.gesture.${gesture}`)}
          </b>
        ))}
      </span>
    );
  }
);
