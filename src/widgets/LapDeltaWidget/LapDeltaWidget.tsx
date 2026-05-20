import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { DeltaDisplay } from './DeltaDisplay/DeltaDisplay';
import { SectorList } from './SectorList/SectorList';

export const LapDeltaWidget = observer(() => {
  const { layout, showSectorTimes } = widgetSettingsStore.getLapDeltaSettings();
  const isHorizontal = layout === 'horizontal';

  return (
    <WidgetPanel direction="column" gap={0} minWidth={150}>
      <DeltaDisplay isHorizontal={isHorizontal} />
      {showSectorTimes && <SectorList isHorizontal={isHorizontal} />}
    </WidgetPanel>
  );
});
