import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './DriverRow.module.scss';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface PosChangeProps {
  carIdx: number;
}

export const PosChange = observer(({ carIdx }: PosChangeProps) => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const driver = computed.driverMap.get(carIdx);
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');
  const effectiveStartPos = computed.getEffectiveStartPos(carIdx);

  if (!driver) {
    return null;
  }

  const position = settings.enableClassCycling
    ? driver.classPosition
    : driver.position;

  const startPos = settings.enableClassCycling
    ? effectiveStartPos.class
    : effectiveStartPos.overall;

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
