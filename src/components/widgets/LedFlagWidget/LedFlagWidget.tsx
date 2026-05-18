import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseSessionFlags } from '../../../utils/flags-utils';
import { useFlagBlink, useFlagHold } from '../../../hooks/flags-hooks';
import { LedMatrix } from './LedMatrix/LedMatrix';

const IS_NO_FLAG = (value: string) => value === 'none';

export const LedFlagWidget = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('led-flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const liveFlag = parseSessionFlags(sessionFlags, playerCarFlags);

  const displayFlag = useFlagHold(liveFlag, IS_NO_FLAG, 'none', holdDuration);
  const blinkOn = useFlagBlink();

  if (!alwaysShow && displayFlag === 'none') {
    return null;
  }

  return <LedMatrix flag={displayFlag} blinkOn={blinkOn} />;
});
