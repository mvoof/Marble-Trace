import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { LapTimesContent } from './LapTimesContent/LapTimesContent';

export const LapTimesWidget = observer(() => (
  <WidgetPanel direction="column" gap={0} minWidth={200}>
    <LapTimesContent />
  </WidgetPanel>
));
