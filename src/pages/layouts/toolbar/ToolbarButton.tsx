import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { LucideIcon } from 'lucide-react';

import { cx } from '@shared/lib/class-names';

import { useToolbarCompact } from './toolbar-compact-context';
import styles from './ToolbarButton.module.scss';

const ICON_SIZE = 14;

interface ToolbarButtonProps {
  icon?: LucideIcon;
  /** Shown beside the icon; without an icon it is always shown. */
  label?: ReactNode;
  /**
   * The label goes when the bar is short of room — below ~1280 px or on the
   * floating pill — and the tooltip carries it.
   */
  isLabelCollapsible?: boolean;
  /** The tooltip, and the name a screen reader reads. */
  title: string;
  /** A toggle that is on, or the picked one of a group. */
  isOn?: boolean;
  tone?: 'plain' | 'accent';
  /** A picker: a caret after the label, the label in the primary colour. */
  isSelect?: boolean;
  isDisabled?: boolean;
  isExpanded?: boolean;
  onClick?: () => void;
}

/** A control of the editor bar: `tb-btn` and `tb-select` of the mockup. */
export const ToolbarButton = observer(
  ({
    icon: Icon,
    label,
    isLabelCollapsible = false,
    title,
    isOn = false,
    tone = 'plain',
    isSelect = false,
    isDisabled = false,
    isExpanded,
    onClick,
  }: ToolbarButtonProps) => {
    const isCompact = useToolbarCompact();
    const isLabelShown =
      label !== undefined && !(isLabelCollapsible && isCompact && Icon);
    const isIconOnly = !isLabelShown && !isSelect;

    return (
      <button
        type="button"
        className={cx(
          styles.button,
          isSelect && styles.select,
          isIconOnly && styles.iconOnly,
          isOn && styles.on,
          tone === 'accent' && styles.accent
        )}
        title={title}
        aria-label={title}
        aria-pressed={isSelect ? undefined : isOn}
        aria-expanded={isExpanded}
        disabled={isDisabled}
        onClick={onClick}
      >
        {Icon && <Icon size={ICON_SIZE} />}

        {isLabelShown && (
          <span
            className={cx(
              styles.label,
              isLabelCollapsible && Icon && styles.labelCollapsible
            )}
          >
            {label}
          </span>
        )}
      </button>
    );
  }
);
