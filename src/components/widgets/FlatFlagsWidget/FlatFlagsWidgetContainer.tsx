import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseAllSessionFlags } from '../FlagsWidget/flags-utils';
import type { FlagType } from '../../../types/flags';
import { FlatFlagsWidget } from './FlatFlagsWidget';

export const FlatFlagsWidgetContainer = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('flat-flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const liveFlags = parseAllSessionFlags(sessionFlags, playerCarFlags);

  const [displayFlags, setDisplayFlags] = useState<FlagType[]>(liveFlags);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayFlagsRef = useRef(displayFlags);
  displayFlagsRef.current = displayFlags;

  const liveFlagsKey = liveFlags.join(',');

  useEffect(() => {
    if (liveFlags.length > 0) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setDisplayFlags(liveFlags);
    } else {
      if (holdDuration > 0 && displayFlagsRef.current.length > 0) {
        holdTimerRef.current = setTimeout(() => {
          setDisplayFlags([]);
        }, holdDuration * 1000);
      } else if (holdDuration === 0) {
        setDisplayFlags([]);
      }
    }
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
    // liveFlagsKey is a stable string derived from liveFlags — used intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFlagsKey, holdDuration]);

  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);

  if (!alwaysShow && displayFlags.length === 0) return null;

  return <FlatFlagsWidget flags={displayFlags} blinkOn={blinkOn} />;
});
