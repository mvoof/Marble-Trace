import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { parseSessionFlags } from '@utils/formatters/flags-utils';
import { useFlagBlink, useFlagHold } from '@hooks/flags-hooks';
import {
  BLOCKS,
  MIN_SINGLE_LED_PX,
  computeDiodesPerBlock,
  buildGridData,
} from '@utils/widget/led-flag-utils';
import { getColorClass, getSingleLedColorClass } from './led-matrix-utils';
import type { FlagType } from '@/types';

import styles from './LedMatrix.module.scss';

const IS_NO_FLAG = (value: string) => value === 'none';

export const LedMatrix = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('led-flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const liveFlag = parseSessionFlags(sessionFlags, playerCarFlags);

  const flag = useFlagHold(
    liveFlag,
    IS_NO_FLAG as (value: FlagType) => boolean,
    'none' as FlagType,
    holdDuration
  );
  const blinkOn = useFlagBlink();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    diodesPerBlock: 6,
    isSingleLed: false,
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

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

  const shouldHide = !alwaysShow && flag === 'none';
  const isOff =
    flag === 'none' || ((flag === 'yellow' || flag === 'red') && !blinkOn);

  if (layout.isSingleLed) {
    const colorClass = isOff ? '' : getSingleLedColorClass(flag);

    return (
      <div ref={wrapperRef} className={styles.wrapper}>
        {!shouldHide && (
          <div className={styles.singleLed}>
            <div
              className={`${styles.singleLedInner}${colorClass ? ` ${colorClass}` : ''}`}
            />
          </div>
        )}
      </div>
    );
  }

  const gridData = buildGridData(layout.diodesPerBlock);
  const matrixSize = BLOCKS * layout.diodesPerBlock;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      {!shouldHide && (
        <div
          className={styles.board}
          style={
            {
              '--dpb': layout.diodesPerBlock,
              '--blocks': BLOCKS,
            } as object
          }
        >
          {gridData.map(({ diodes, key }) => (
            <div key={key} className={styles.block}>
              {diodes.map(({ gx, gy, bx, by, isCorner, key: dk }) => {
                if (isCorner) {
                  return <div key={dk} className={styles.diodeHidden} />;
                }

                const colorClass = isOff
                  ? ''
                  : getColorClass(gx, gy, bx, by, flag, matrixSize);

                return (
                  <div
                    key={dk}
                    className={`${styles.diode}${colorClass ? ` ${colorClass}` : ''}`}
                  />
                );
              })}
            </div>
          ))}

          <div className={styles.glassOverlay} aria-hidden="true" />
        </div>
      )}
    </div>
  );
});
