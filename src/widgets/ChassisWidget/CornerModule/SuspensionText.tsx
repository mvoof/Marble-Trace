import { observer } from 'mobx-react-lite';

import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import styles from './SuspensionText.module.scss';

interface SuspensionTextProps {
  value: string;
  unit: string;
  color?: string;
}

export const SuspensionText = observer(
  ({ value, unit, color = '#fff' }: SuspensionTextProps) => (
    <WidgetValue
      value={value}
      unit={unit}
      color={color}
      className={styles.root}
      unitClassName={styles.unit}
    />
  )
);
