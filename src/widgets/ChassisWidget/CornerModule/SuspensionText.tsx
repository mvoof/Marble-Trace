import { observer } from 'mobx-react-lite';

import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';
import styles from './SuspensionText.module.scss';

interface SuspensionTextProps {
  value: string;
  unit: string;
  color?: string;
}

export const SuspensionText = observer(
  ({ value, unit, color = '#fff' }: SuspensionTextProps) => (
    <UnitValueText
      value={value}
      unit={unit}
      color={color}
      className={styles.root}
      unitClassName={styles.unit}
    />
  )
);
