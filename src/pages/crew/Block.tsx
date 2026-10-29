import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'antd';
import { ChevronDown, GripVertical, X } from 'lucide-react';
import type { BlockDragState } from './useBlockDrag';
import styles from './CrewPage.module.scss';

/** How a block looks: its kind, read from its outline rather than a label. */
export type BlockTone = 'words' | 'value' | 'choice' | 'optional';

const TONE_CLASSES: Record<BlockTone, string | undefined> = {
  words: undefined,
  value: styles.blockValue,
  choice: styles.blockChoice,
  optional: styles.blockOptional,
};

/** A block turned into another kind: made optional, made a choice. */
export interface BlockChange {
  key: string;
  label: string;
  onClick: () => void;
}

interface BlockProps {
  tone: BlockTone;
  /** A value or a choice that may be left out, outlined like an optional part. */
  optional?: boolean;
  drag: BlockDragState;
  /** What the block can be turned into, in a menu beside its cross. */
  changes?: BlockChange[];
  onRemove: () => void;
  children: ReactNode;
}

/**
 * One block as a chip: held by its grip to move it, turned into another kind
 * from its menu, removed by its cross — all shown when the pointer is over it.
 */
export const Block = observer(
  ({
    tone,
    optional = false,
    drag,
    changes = [],
    onRemove,
    children,
  }: BlockProps) => {
    const { t } = useTranslation('main-app');
    const classNames = [
      styles.block,
      TONE_CLASSES[tone],
      optional && styles.blockOptional,
      drag.dragging && styles.blockDragged,
      drag.drop === 'before' && styles.blockDropBefore,
      drag.drop === 'after' && styles.blockDropAfter,
    ].filter(Boolean);

    return (
      <div className={classNames.join(' ')} {...drag.attributes}>
        <span
          className={styles.blockHandle}
          title={t('crewPage.blocks.move')}
          {...drag.handle}
        >
          <GripVertical size={12} />
        </span>

        {children}

        {changes.length > 0 && (
          <Dropdown
            menu={{
              items: changes.map(({ key, label, onClick }) => ({
                key,
                label,
                onClick,
              })),
            }}
            trigger={['click']}
          >
            <button
              type="button"
              className={styles.blockTool}
              aria-label={t('crewPage.blocks.change')}
            >
              <ChevronDown size={12} />
            </button>
          </Dropdown>
        )}

        <button
          type="button"
          className={styles.blockTool}
          onClick={onRemove}
          aria-label={t('crewPage.blocks.remove')}
        >
          <X size={12} />
        </button>
      </div>
    );
  }
);
