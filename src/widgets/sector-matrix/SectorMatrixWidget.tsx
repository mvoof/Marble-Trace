import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { NoDataPlaceholder } from '@shared/ui/NoDataPlaceholder/NoDataPlaceholder';
import { useSessionStore } from '@entities/session/session-context';
import { useSimStore } from '@entities/sim/sim-context';
import { SectorHeader } from './SectorHeader/SectorHeader';
import { SectorGrid } from './SectorGrid/SectorGrid';
import { SectorFooter } from './SectorFooter/SectorFooter';
import type { SectorMatrixWidgetSettings } from './settings-schema';

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
