import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';

import styles from './SectorMatrixRow.module.scss';

interface SectorMatrixRowProps {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
  fill?: boolean;
}

export const SectorMatrixRow = observer(
  ({
    label,
    time,
    delta,
    accentColor,
    deltaColor,
    fill = false,
  }: SectorMatrixRowProps) => (
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
