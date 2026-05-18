import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseAllSessionFlags } from '../../../utils/flags-utils';
import { useFlagBlink, useFlagHold } from '../../../hooks/flags-hooks';
import type { FlagType } from '../../../types';

import styles from './FlatFlagsWidget.module.scss';

const FLAG_LABEL: Record<FlagType, string> = {
  none: '',
  green: 'GREEN FLAG',
  yellow: 'YELLOW FLAG',
  red: 'RED FLAG',
  blue: 'BLUE FLAG',
  white: 'LAST LAP',
  checkered: 'CHECKERED',
  black: 'BLACK FLAG',
  meatball: 'MEATBALL',
  debris: 'DEBRIS',
};

const FLAG_ITEM_CLASS: Record<FlagType, string> = {
  none: '',
  green: styles.itemGreen,
  yellow: styles.itemYellow,
  red: styles.itemRed,
  blue: styles.itemBlue,
  white: styles.itemWhite,
  checkered: styles.itemCheckered,
  black: styles.itemBlack,
  meatball: styles.itemMeatball,
  debris: styles.itemDebris,
};

const BLINK_FLAGS = new Set<FlagType>(['yellow', 'red']);

const EMPTY_FLAGS: FlagType[] = [];
const IS_EMPTY_FLAGS = (flagsList: FlagType[]) => flagsList.length === 0;

export const FlatFlagsWidget = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('flat-flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const parsedFlags = parseAllSessionFlags(sessionFlags, playerCarFlags);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveFlags = useMemo(() => parsedFlags, [parsedFlags.join(',')]);

  const displayFlags = useFlagHold(
    liveFlags,
    IS_EMPTY_FLAGS,
    EMPTY_FLAGS,
    holdDuration
  );

  const blinkOn = useFlagBlink();

  if (!alwaysShow && displayFlags.length === 0) {
    return null;
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>FLAGS</div>
      <div className={styles.list}>
        {displayFlags.length === 0 ? (
          <div className={styles.empty}>NO ACTIVE FLAGS</div>
        ) : (
          displayFlags.map((flag) => {
            const isBlinkOff = BLINK_FLAGS.has(flag) && !blinkOn;
            return (
              <div
                key={flag}
                className={`${styles.item} ${FLAG_ITEM_CLASS[flag]}${isBlinkOff ? ` ${styles.itemBlinkOff}` : ''}`}
              >
                {FLAG_LABEL[flag]}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
