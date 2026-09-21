import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import type { CellRenderWeight } from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface EngineCellProps {
  label: string;
  /**
   * How the cell is drawn: `lead` large, `plain` at reading size, `satellite`
   * small because it stands two to a column beside a lead. It is the slot the
   * cell landed in, not what its spec asked for.
   */
  weight?: CellRenderWeight;
  className?: string;
  children: ReactNode;
}

const WEIGHT_CLASS: Record<CellRenderWeight, string> = {
  lead: styles.lead,
  plain: styles.plain,
  satellite: styles.satellite,
};

export const EngineCell = observer(
  ({ label, weight = 'plain', className = '', children }: EngineCellProps) => {
    const weightClass = WEIGHT_CLASS[weight];

    return (
      <div className={`${styles.cell} ${weightClass} ${className}`}>
        <WidgetLabel mono={false} uppercase className={styles.label}>
          {label}
        </WidgetLabel>

        <div className={styles.cellValues}>{children}</div>
      </div>
    );
  }
);
