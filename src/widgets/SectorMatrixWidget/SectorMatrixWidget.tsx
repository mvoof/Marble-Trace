import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import { SectorHeader } from './SectorHeader/SectorHeader';
import { SectorGrid } from './SectorGrid/SectorGrid';
import { SectorFooter } from './SectorFooter/SectorFooter';

export const SectorMatrixWidget = observer(() => {
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showSectors } =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const sectorCount = sessionInfo?.sectors.length || 3;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <SectorHeader sectorCount={sectorCount} />

      {showSectors && <SectorGrid sectorCount={sectorCount} />}

      <SectorFooter />
    </WidgetPanel>
  );
});
