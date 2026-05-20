import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { FuelChart } from '@widgets/FuelWidget/FuelChart/FuelChart';
import { FuelHeader } from './FuelHeader/FuelHeader';
import { FuelProgress } from './FuelProgress/FuelProgress';
import { FuelDataGrid } from './FuelDataGrid/FuelDataGrid';
import { FuelFinishCard } from './FuelFinishCard/FuelFinishCard';
import { FuelPitWarning } from './FuelPitWarning/FuelPitWarning';

export const FuelWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={220}>
      <FuelHeader />
      <FuelProgress />
      <FuelDataGrid />
      <FuelFinishCard />
      <FuelChart />
      <FuelPitWarning />
    </WidgetPanel>
  );
});
