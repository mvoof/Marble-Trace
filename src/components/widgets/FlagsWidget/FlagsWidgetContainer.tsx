import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseSessionFlags } from '../../../utils/flags-utils';
import { useFlagBlink, useFlagHold } from '../../../hooks/flags-hooks';
import { FlagsWidget } from './FlagsWidget';

const IS_NO_FLAG = (v: string) => v === 'none';

export const FlagsWidgetContainer = observer(() => {
  const { alwaysShow, holdDuration } =
    widgetSettingsStore.getFlagDisplaySettings('flags');

  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const playerCarFlags = telemetryStore.session?.player_car_flags ?? null;
  const liveFlag = parseSessionFlags(sessionFlags, playerCarFlags);

  const displayFlag = useFlagHold(liveFlag, IS_NO_FLAG, 'none', holdDuration);
  const blinkOn = useFlagBlink();

  if (!alwaysShow && displayFlag === 'none') return null;

  return <FlagsWidget flag={displayFlag} blinkOn={blinkOn} />;
});
