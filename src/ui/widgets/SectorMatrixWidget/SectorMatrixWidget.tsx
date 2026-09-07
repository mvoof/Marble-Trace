import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { NoDataPlaceholder } from '@ui/shared/NoDataPlaceholder/NoDataPlaceholder';
import { useSessionStore, useSimStore } from '@store/root-store-context';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import { SectorHeader } from './SectorHeader/SectorHeader';
import { SectorGrid } from './SectorGrid/SectorGrid';
import { SectorFooter } from './SectorFooter/SectorFooter';

export const SectorMatrixWidget = observer(() => {
  const { sessionInfo } = useSessionStore();
  const sim = useSimStore();

  const { showSectors } =
    useWidgetSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const sectorCount = sessionInfo?.sectors.length || 3;
  const hasData = sim.isConnected && sessionInfo != null;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      {!hasData ? (
        <NoDataPlaceholder />
      ) : (
        <>
          <SectorHeader sectorCount={sectorCount} />

          {showSectors && <SectorGrid sectorCount={sectorCount} />}

          <SectorFooter />
        </>
      )}
    </WidgetPanel>
  );
});
