import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { TimerClockRow } from './TimerClockRow/TimerClockRow';
import { TimerDateRow } from './TimerDateRow/TimerDateRow';
import { TimerDisplay } from './TimerDisplay/TimerDisplay';
import { TimerFooter } from './TimerFooter/TimerFooter';
import { TimerHeader } from './TimerHeader/TimerHeader';

export const TimerWidget = observer(() => {
  const {
    showLaps,
    showPosition,
    showWallClock,
    showSimTime,
    showPcDate,
    showSimDate,
  } = widgetSettingsStore.getTimerSettings();

  const showClockRow = showWallClock || showSimTime;
  const showDateRow = showPcDate || showSimDate;
  const showFooter = showLaps || showPosition;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={180}>
      <TimerHeader />

      <TimerDisplay />

      {showClockRow && <TimerClockRow />}

      {showDateRow && <TimerDateRow />}

      {showFooter && <TimerFooter />}
    </WidgetPanel>
  );
});
