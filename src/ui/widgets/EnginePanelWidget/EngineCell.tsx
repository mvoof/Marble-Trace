import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import styles from './EnginePanelWidget.module.scss';

export interface EngineCellProps {
  label: string;
  className?: string;
  dividerRight?: boolean;
  dividerTop?: boolean;
  children: ReactNode;
}

export const EngineCell = observer(
  ({
    label,
    className = '',
    dividerRight = false,
    dividerTop = false,
    children,
  }: EngineCellProps) => {
    const dividerClasses = [
      dividerRight ? styles.dividerRight : '',
      dividerTop ? styles.dividerTop : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`${styles.cell} ${dividerClasses} ${className}`}>
        <div className={styles.cellHeader}>
          <WidgetLabel mono={false} uppercase className={styles.label}>
            {label}
          </WidgetLabel>
        </div>

        <div className={styles.cellValues}>{children}</div>
      </div>
    );
  }
);
