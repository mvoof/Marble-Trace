import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { TimerRow } from './TimerRow/TimerRow';
import { TimerDisplay } from './TimerDisplay/TimerDisplay';
import { TimerFooter } from './TimerFooter/TimerFooter';
import { TimerHeader } from './TimerHeader/TimerHeader';

export const TimerWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={180}>
      <TimerHeader />

      <TimerDisplay />

      <TimerRow />

      <TimerFooter />
    </WidgetPanel>
  );
});
