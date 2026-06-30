import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import styles from './EnginePanelWidget.module.scss';

interface EngineCellProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export const EngineCell = observer(
  ({ label, className = '', children }: EngineCellProps) => {
    return (
      <div className={`${styles.cell} ${className}`}>
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
