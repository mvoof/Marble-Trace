import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { TimerClockRow } from './TimerClockRow/TimerClockRow';
import { TimerDateRow } from './TimerDateRow/TimerDateRow';
import { TimerDisplay } from './TimerDisplay/TimerDisplay';
import { TimerFooter } from './TimerFooter/TimerFooter';
import { TimerHeader } from './TimerHeader/TimerHeader';

export const TimerWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={180}>
      <TimerHeader />

      <TimerDisplay />

      <TimerClockRow />

      <TimerDateRow />

      <TimerFooter />
    </WidgetPanel>
  );
});
