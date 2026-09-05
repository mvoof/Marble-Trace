import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './WidgetLabel.module.scss';

interface WidgetLabelProps {
  children: ReactNode;
  className?: string;
  mono?: boolean;
  uppercase?: boolean;
}

export const WidgetLabel = observer(function WidgetLabel({
  children,
  className,
  mono = false,
  uppercase = true,
}: WidgetLabelProps) {
  return (
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
  );
});
