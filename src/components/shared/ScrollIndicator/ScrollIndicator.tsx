import { observer } from 'mobx-react-lite';

import type { ScrollThumb } from '@utils/widget/scroll-thumb';

import styles from './ScrollIndicator.module.scss';

interface ScrollIndicatorProps {
  thumb: ScrollThumb | null;
  visible: boolean;
  /**
   * Sits a lane further in, so a nested list's own bar clears the one tracking
   * the outer list at the widget edge.
   */
  inset?: boolean;
}

export const ScrollIndicator = observer(
  ({ thumb, visible, inset = false }: ScrollIndicatorProps) => {
    if (!visible || thumb === null) {
      return null;
    }

    return (
      <div
        className={`${styles.track} ${inset ? styles.trackInset : ''}`}
        aria-hidden
      >
        <div
          className={styles.thumb}
          style={{
            height: `${thumb.heightPercent}%`,
            top: `${thumb.topPercent}%`,
          }}
        />
      </div>
    );
  }
);
