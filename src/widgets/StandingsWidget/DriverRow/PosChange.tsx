import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './DriverRow.module.scss';
import {
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface PosChangeProps {
  carIdx: number;
}

export const PosChange = observer(({ carIdx }: PosChangeProps) => {
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const driver = standingsWidget.driverMap.get(carIdx);
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!driver) {
    return null;
  }

  const useClassPos = settings.viewMode !== 'all';

  const position = useClassPos ? driver.classPosition : driver.position;

  const startPos = useClassPos ? driver.startPosClass : driver.startPosOverall;

  if (startPos === 0) {
    return <span className={styles.posChangeNeutral}>-</span>;
  }

  const diff = startPos - position;

  if (diff > 0) {
    return (
      <span className={styles.posChangeUp}>
        <ChevronUp size={12} />
        {diff}
      </span>
    );
  }

  if (diff < 0) {
    return (
      <span className={styles.posChangeDown}>
        <ChevronDown size={12} />
        {Math.abs(diff)}
      </span>
    );
  }

  return <span className={styles.posChangeNeutral}>-</span>;
});
