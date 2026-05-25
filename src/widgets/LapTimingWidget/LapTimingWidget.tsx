import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { useTelemetryStore } from '@store/root-store-context';
import { SectorHeader } from './SectorHeader/SectorHeader';
import { SectorGrid } from './SectorGrid/SectorGrid';
import { SectorFooter } from './SectorFooter/SectorFooter';

export const LapTimingWidget = observer(() => {
  const { sessionInfo } = useTelemetryStore();

  const sectorCount = sessionInfo?.SplitTimeInfo?.Sectors?.length ?? 3;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <SectorHeader sectorCount={sectorCount} />

      <SectorGrid sectorCount={sectorCount} />

      <SectorFooter />
    </WidgetPanel>
  );
});
