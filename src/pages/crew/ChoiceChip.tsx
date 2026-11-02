import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Popover, Select } from 'antd';
import styles from './CrewPage.module.scss';

interface ChoiceChipProps {
  options: string[];
  initiallyOpen?: boolean;
  /** The options as they stand when the editor closes. */
  onCommit: (options: string[]) => void;
}

/** "One of" as its options in a row; they are edited in a popover. */
export const ChoiceChip = observer(
  ({ options, initiallyOpen = false, onCommit }: ChoiceChipProps) => {
    const { t } = useTranslation('main-app');
    const [open, setOpen] = useState(initiallyOpen);
    const [draft, setDraft] = useState(options);
    const changeOpen = (next: boolean) => {
      if (next) {
        setDraft(options);
      } else {
        onCommit(draft);
      }

      setOpen(next);
    };

    return (
      <Popover
        trigger="click"
        placement="bottomLeft"
        open={open}
        onOpenChange={changeOpen}
        content={
          <div className={styles.slotPopover}>
            <Select
              className={styles.choiceOptions}
              mode="tags"
              open={false}
              suffixIcon={null}
              value={draft}
              onChange={(next: string[]) => setDraft(next)}
            />

            <div className={styles.fieldDesc}>
              {t('crewPage.blocks.choiceHint')}
            </div>
          </div>
        }
      >
        <button type="button" className={styles.blockChip}>
          {options.length > 0 ? options.join(' / ') : '…'}
        </button>
      </Popover>
    );
  }
);
