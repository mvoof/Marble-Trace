import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Check, type LucideIcon } from 'lucide-react';

import { cx } from '@shared/lib/class-names';

import styles from './ToolbarMenuItem.module.scss';

const ICON_SIZE = 14;

interface ToolbarMenuItemProps {
  icon?: LucideIcon;
  label: ReactNode;
  /** Muted text after the label: a hint, a size, a state. */
  note?: ReactNode;
  /** A toggle or a choice: a tick when on. */
  isChecked?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  /** Something acting on this row alone, at its right end. */
  action?: ReactNode;
}

/** One row of a menu of the bar, ~28 px. */
export const ToolbarMenuItem = observer(
  ({
    icon: Icon,
    label,
    note,
    isChecked,
    isDisabled = false,
    onClick,
    action,
  }: ToolbarMenuItemProps) => (
    <div className={cx(styles.row, isChecked && styles.rowChecked)}>
      <button
        type="button"
        className={styles.item}
        role={isChecked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={isChecked}
        disabled={isDisabled}
        onClick={onClick}
      >
        <span className={styles.icon}>{Icon && <Icon size={ICON_SIZE} />}</span>

        <span className={styles.label}>{label}</span>

        {note !== undefined && <span className={styles.note}>{note}</span>}

        {isChecked && <Check size={ICON_SIZE} className={styles.check} />}
      </button>

      {action}
    </div>
  )
);

/** A titled run of rows inside a menu. */
export const ToolbarMenuSection = observer(
  ({ title, children }: { title?: string; children: ReactNode }) => (
    <div className={styles.section}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      {children}
    </div>
  )
);
