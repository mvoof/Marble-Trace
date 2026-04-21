import { LedMatrix } from './LedMatrix/LedMatrix';
import type { FlagType, FlagsWidgetSettings } from './types';

import styles from './FlagsWidget.module.scss';

export interface FlagsWidgetProps {
  flag: FlagType;
  settings: FlagsWidgetSettings;
  blinkOn: boolean;
  blocksX: number;
  blocksY: number;
}

export const FlagsWidget = ({
  flag,
  settings,
  blinkOn,
  blocksX,
  blocksY,
}: FlagsWidgetProps) => {
  const cutoutWidth = settings.variant === 'overlay' ? settings.cutoutWidth : 0;
  const cutoutHeight =
    settings.variant === 'overlay' ? settings.cutoutHeight : 0;

  return (
    <div className={styles.wrapper}>
      <LedMatrix
        blocksX={blocksX}
        blocksY={blocksY}
        cutoutWidth={cutoutWidth}
        cutoutHeight={cutoutHeight}
        flag={flag}
        blinkOn={blinkOn}
      />
    </div>
  );
};
