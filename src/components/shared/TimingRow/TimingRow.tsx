import { observer } from 'mobx-react-lite';

import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';
import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';

import styles from './TimingRow.module.scss';

interface TimingRowProps {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
  fill?: boolean;
}

export const TimingRow = observer(
  ({
    label,
    time,
    delta,
    accentColor,
    deltaColor,
    fill = false,
  }: TimingRowProps) => (
    <div
      className={`${styles.row} ${fill ? styles.fill : ''}`}
      style={{ borderLeftColor: accentColor }}
    >
      <UnitLabelText className={styles.label}>{label}</UnitLabelText>

      <UnitValueText value={time} className={styles.time} />

      <UnitValueText
        value={delta || ' '}
        color={deltaColor ?? accentColor}
        className={`${styles.delta} ${!delta ? styles.hiddenDelta : ''}`}
      />
    </div>
  )
);
