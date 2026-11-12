import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import styles from './EnginePanelWidget.module.scss';
import { cx } from '@shared/lib/class-names';

export interface EngineCellProps {
  label: string;
  /** Drawn at the larger size: what the hands move mid-corner. */
  lead?: boolean;
  /** A knob just moved: the cell lights in its strip's tone. */
  lit?: boolean;
  className?: string;
  children: ReactNode;
}

/** A label and its value on one line, the value at the far end. */
export const EngineCell = observer(
  ({
    label,
    lead = false,
    lit = false,
    className = '',
    children,
  }: EngineCellProps) => {
    const classes = cx(styles.cell, lead ? styles.lead : '', className);

    return (
      <div className={classes}>
        {lit ? <div className={styles.changeFlash} /> : null}

        <span className={styles.label}>{label}</span>

        <div className={styles.cellValues}>{children}</div>
      </div>
    );
  }
);
