import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseAllSessionFlags } from '../../../utils/flags-utils';
import { useFlagBlink, useFlagHold } from '../../../hooks/flags-hooks';
import { EMPTY_FLAGS, IS_EMPTY_FLAGS } from './flat-flags-utils';
import { FlagList } from './FlagList/FlagList';

import styles from './FlatFlagsWidget.module.scss';

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

      <FlagList displayFlags={displayFlags} blinkOn={blinkOn} />
    </div>
  );
});
