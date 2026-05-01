import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseAllSessionFlags } from '../../../utils/flags-utils';
import { useFlagBlink, useFlagHold } from '../../../hooks/flags-hooks';
import type { FlagType } from '../../../types/flags';
import { FlatFlagsWidget } from './FlatFlagsWidget';

const EMPTY_FLAGS: FlagType[] = [];
const IS_EMPTY_FLAGS = (v: FlagType[]) => v.length === 0;

export const FlatFlagsWidgetContainer = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('flat-flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const parsedFlags = parseAllSessionFlags(sessionFlags, playerCarFlags);

  // Stabilize array reference so useFlagHold dependency doesn't fire on every render
  const liveFlagsKey = parsedFlags.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveFlags = useMemo(() => parsedFlags, [liveFlagsKey]);

  const displayFlags = useFlagHold(
    liveFlags,
    IS_EMPTY_FLAGS,
    EMPTY_FLAGS,
    holdDuration
  );
  const blinkOn = useFlagBlink();

  if (!alwaysShow && displayFlags.length === 0) return null;

  return <FlatFlagsWidget flags={displayFlags} blinkOn={blinkOn} />;
});
