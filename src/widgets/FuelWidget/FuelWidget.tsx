import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { FuelChart } from '@widgets/FuelWidget/FuelChart/FuelChart';
import { FuelHeader } from './FuelHeader/FuelHeader';
import { FuelProgress } from './FuelProgress/FuelProgress';
import { FuelStatsRow } from './FuelStatsRow/FuelStatsRow';
import { FuelLapsSection } from './FuelLapsSection/FuelLapsSection';
import { FuelPitWarning } from './FuelPitWarning/FuelPitWarning';

export const FuelWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={220}>
      <FuelHeader />
      <FuelProgress />
      <FuelStatsRow />
      <FuelLapsSection />
      <FuelChart />
      <FuelPitWarning />
    </WidgetPanel>
  );
});
