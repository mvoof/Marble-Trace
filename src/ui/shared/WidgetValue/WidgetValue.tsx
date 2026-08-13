import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './WidgetValue.module.scss';

interface WidgetValueProps {
  value: ReactNode;
  unit?: string;
  color?: string;
  className?: string;
  unitClassName?: string;
}

export const WidgetValue = observer(
  ({ value, unit, color, className, unitClassName }: WidgetValueProps) => (
    <span
      className={`${styles.root} ${className ?? ''}`}
      style={color ? { color } : undefined}
    >
      {value}

      {unit && (
        <span className={`${styles.unit} ${unitClassName ?? ''}`}>{unit}</span>
      )}
    </span>
  )
);
