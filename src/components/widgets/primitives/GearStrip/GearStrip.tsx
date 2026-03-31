import { useMemo } from 'react';

import styles from './GearStrip.module.scss';

const GEARS = ['R', 'N', '1', '2', '3', '4', '5', '6'];
const ITEM_WIDTH = 20;

interface GearStripProps {
  gear: number;
  accentColor?: string;
}

export const GearStrip = ({
  gear,
  accentColor = '#ff4d00',
}: GearStripProps) => {
  const gearIndex = useMemo(() => {
    if (gear < 0) return 0; // R
    if (gear === 0) return 1; // N
    return Math.min(gear + 1, GEARS.length - 1);
  }, [gear]);

  const trackOffset = -(gearIndex * ITEM_WIDTH) - ITEM_WIDTH / 2;

  return (
    <span className={styles.container}>
      <span className={styles.frame} style={{ borderColor: accentColor }} />

      <span
        className={styles.track}
        style={{ transform: `translateX(${trackOffset}px)` }}
      >
        {GEARS.map((g, i) => {
          const dist = Math.abs(i - gearIndex);
          const opacity = Math.max(0, 1 - dist * 0.75);

          return (
            <span key={g} className={styles.item} style={{ opacity }}>
              {g}
            </span>
          );
        })}
      </span>
    </span>
  );
};
