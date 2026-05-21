import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './UnitLabelText.module.scss';

interface UnitLabelTextProps {
  children: ReactNode;
  className?: string;
  mono?: boolean;
  uppercase?: boolean;
}

export const UnitLabelText = observer(
  ({
    children,
    className,
    mono = false,
    uppercase = true,
  }: UnitLabelTextProps) => (
    <span
      className={[
        styles.label,
        mono ? styles.mono : '',
        !uppercase ? styles.noUppercase : '',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </span>
  )
);
