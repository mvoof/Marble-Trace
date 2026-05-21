import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './UnitValueText.module.scss';

interface UnitValueTextProps {
  value: ReactNode;
  unit?: string;
  color?: string;
  className?: string;
  unitClassName?: string;
}

export const UnitValueText = observer(
  ({ value, unit, color, className, unitClassName }: UnitValueTextProps) => (
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
