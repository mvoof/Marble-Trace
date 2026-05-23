import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import {
  MIN_SINGLE_LED_PX,
  computeDiodesPerBlock,
} from '@utils/widget/led-flag-utils';
import { SingleLed } from './SingleLed/SingleLed';
import { LedMatrix } from './LedMatrix/LedMatrix';

import styles from './LedFlagWidget.module.scss';

export const LedFlagWidget = observer(() => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState({
    diodesPerBlock: 6,
    isSingleLed: false,
  });

  useEffect(() => {
    const el = wrapperRef.current;

    if (!el) {
      return;
    }

    const obs = new ResizeObserver(([entry]) => {
      const smallestSide = Math.min(
        entry.contentRect.width,
        entry.contentRect.height
      );

      if (smallestSide < MIN_SINGLE_LED_PX) {
        setLayout((prev) =>
          prev.isSingleLed ? prev : { ...prev, isSingleLed: true }
        );
      } else {
        const nextDiodes = computeDiodesPerBlock(smallestSide);

        setLayout((prev) =>
          !prev.isSingleLed && prev.diodesPerBlock === nextDiodes
            ? prev
            : { isSingleLed: false, diodesPerBlock: nextDiodes }
        );
      }
    });

    obs.observe(el);

    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      {layout.isSingleLed ? (
        <SingleLed />
      ) : (
        <LedMatrix diodesPerBlock={layout.diodesPerBlock} />
      )}
    </div>
  );
});
