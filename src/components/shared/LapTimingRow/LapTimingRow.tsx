import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';

import styles from './LapTimingRow.module.scss';

interface LapTimingRowProps {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
  fill?: boolean;
}

export const LapTimingRow = observer(
  ({
    label,
    time,
    delta,
    accentColor,
    deltaColor,
    fill = false,
  }: LapTimingRowProps) => (
    <div
      className={`${styles.row} ${fill ? styles.fill : ''}`}
      style={{ borderLeftColor: accentColor }}
    >
      <WidgetLabel className={styles.label}>{label}</WidgetLabel>

      <WidgetValue value={time} className={styles.time} />

      <WidgetValue
        value={delta || ' '}
        color={deltaColor ?? accentColor}
        className={`${styles.delta} ${!delta ? styles.hiddenDelta : ''}`}
      />
    </div>
  )
);
