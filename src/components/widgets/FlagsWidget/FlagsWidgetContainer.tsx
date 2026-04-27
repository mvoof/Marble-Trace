import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseSessionFlags } from './flags-utils';
import type { FlagType } from '../../../types/flags';
import { FlagsWidget } from './FlagsWidget';

import styles from './FlagsWidgetContainer.module.scss';

export const FlagsWidgetContainer = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const liveFlag = parseSessionFlags(sessionFlags, playerCarFlags);

  const [displayFlag, setDisplayFlag] = useState<FlagType>(liveFlag);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayFlagRef = useRef(displayFlag);
  displayFlagRef.current = displayFlag;

  useEffect(() => {
    if (liveFlag !== 'none') {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setDisplayFlag(liveFlag);
    } else {
      if (holdDuration > 0 && displayFlagRef.current !== 'none') {
        holdTimerRef.current = setTimeout(() => {
          setDisplayFlag('none');
        }, holdDuration * 1000);
      } else if (holdDuration === 0) {
        setDisplayFlag('none');
      }
    }
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [liveFlag, holdDuration]);

  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);

  if (!alwaysShow && displayFlag === 'none') return null;

  return (
    <div className={styles.container}>
      <FlagsWidget flag={displayFlag} blinkOn={blinkOn} />
    </div>
  );
});
