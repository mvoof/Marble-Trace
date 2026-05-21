import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { DeltaDisplay } from './DeltaDisplay/DeltaDisplay';
import { SectorList } from './SectorList/SectorList';

export const LapDeltaWidget = observer(() => (
  <WidgetPanel direction="column" gap={0} minWidth={150}>
    <DeltaDisplay />
    <SectorList />
  </WidgetPanel>
));
