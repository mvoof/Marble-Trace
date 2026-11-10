import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { CellRender, CellRenderWeight } from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface EngineCellProps {
  label: string;
  /**
   * How the cell is drawn: its weight — `lead` large, `plain` at reading size,
   * `satellite` small because it stands two to a column beside a lead — and
   * whether the label and the value share one line. It is the slot the cell
   * landed in, not what its spec asked for.
   */
  render?: CellRender;
  /** A knob just moved: the cell lights in its system's tone. */
  lit?: boolean;
  className?: string;
  children: ReactNode;
}

const WEIGHT_CLASS: Record<CellRenderWeight, string> = {
  lead: styles.lead,
  plain: styles.plain,
  satellite: styles.satellite,
};

const DEFAULT_RENDER: CellRender = { weight: 'plain', inline: false };

export const EngineCell = observer(
  ({
    label,
    render = DEFAULT_RENDER,
    lit = false,
    className = '',
    children,
  }: EngineCellProps) => {
    const classes = [
      styles.cell,
      WEIGHT_CLASS[render.weight],
      render.inline ? styles.inline : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={classes}>
        {lit ? <div className={styles.changeFlash} /> : null}

        <span className={styles.label}>{label}</span>

        <div className={styles.cellValues}>{children}</div>
      </div>
    );
  }
);
