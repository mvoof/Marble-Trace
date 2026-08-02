import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { FuelChart } from '@widgets/FuelWidget/FuelChart/FuelChart';
import { FuelHeader } from './FuelHeader/FuelHeader';
import { FuelProgress } from './FuelProgress/FuelProgress';
import { FuelStatsRow } from './FuelStatsRow/FuelStatsRow';
import { FuelSummaryRow } from './FuelSummaryRow/FuelSummaryRow';
import { FuelPitWarning } from './FuelPitWarning/FuelPitWarning';
import { FuelNextStop } from './FuelNextStop/FuelNextStop';

export const FuelWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={220}>
      <FuelHeader />
      <FuelProgress />
      <FuelSummaryRow />
      <FuelStatsRow />
      <FuelChart />
      <FuelNextStop />
      <FuelPitWarning />
    </WidgetPanel>
  );
});
