import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { FuelChart } from '@widgets/fuel/FuelChart/FuelChart';
import { FuelHeader } from './FuelHeader/FuelHeader';
import { FuelProgress } from './FuelProgress/FuelProgress';
import { FuelStatsRow } from './FuelStatsRow/FuelStatsRow';
import { FuelSummaryRow } from './FuelSummaryRow/FuelSummaryRow';
import { FuelPitWarning } from './FuelPitWarning/FuelPitWarning';
import { FuelNextStop } from './FuelNextStop/FuelNextStop';
import { useFuelLapsStatus } from './use-fuel-status';
import styles from './FuelWidget.module.scss';

export const FuelWidget = observer(() => {
  const isLow = useFuelLapsStatus() === 'danger';

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={220}
      className={isLow ? styles.panelLow : undefined}
    >
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
