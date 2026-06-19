import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import {
  MIN_SINGLE_LED_PX,
  computeDiodesPerBlock,
  computeSplitRows,
} from '@utils/widget/led-flag-utils';
import { SingleLed } from './SingleLed/SingleLed';
import { LedMatrix } from './LedMatrix/LedMatrix';
import {
  useWidgetSettingsStore,
  useFlagsStore,
} from '@store/root-store-context';
import { useWidgetAutoHide } from '@hooks/common/useWidgetAutoHide';
import type { FlagDisplaySettings } from '@/types/widget-settings';

import styles from './LedFlagWidget.module.scss';

export const LedFlagWidget = observer(() => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const widgetSettings = useWidgetSettingsStore();
  const flags = useFlagsStore();
  const { split, forceSingleLed, alwaysShow } =
    widgetSettings.getSettings<FlagDisplaySettings>('led-flags');

  const hasContent = alwaysShow || flags.ledDisplayFlag !== 'none';

  useWidgetAutoHide(hasContent);

  const [layout, setLayout] = useState({
    diodesPerBlock: 6,
    splitRows: 18,
    isSingleLed: false,
  });

  useEffect(() => {
    const el = wrapperRef.current;

    if (!el) {
      return;
    }

    const obs = new ResizeObserver(([entry]) => {
      const smallestSide = split
        ? entry.contentRect.height
        : Math.min(entry.contentRect.width, entry.contentRect.height);

      if (smallestSide < MIN_SINGLE_LED_PX) {
        setLayout((prev) =>
          prev.isSingleLed ? prev : { ...prev, isSingleLed: true }
        );
      } else {
        const nextDiodes = computeDiodesPerBlock(smallestSide);
        const nextSplitRows = computeSplitRows(entry.contentRect.height);

        setLayout((prev) =>
          !prev.isSingleLed &&
          prev.diodesPerBlock === nextDiodes &&
          prev.splitRows === nextSplitRows
            ? prev
            : {
                isSingleLed: false,
                diodesPerBlock: nextDiodes,
                splitRows: nextSplitRows,
              }
        );
      }
    });

    obs.observe(el);

    return () => obs.disconnect();
  }, [split]);

  const renderContent = () => {
    if (forceSingleLed || layout.isSingleLed) {
      return <SingleLed />;
    }
    return (
      <LedMatrix
        diodesPerBlock={layout.diodesPerBlock}
        splitRows={layout.splitRows}
      />
    );
  };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      {split ? (
        <div className={styles.splitWrapper}>
          <div className={styles.leftSlot}>{renderContent()}</div>
          <div className={styles.rightSlot}>{renderContent()}</div>
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
});
