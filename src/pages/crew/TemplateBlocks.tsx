import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dropdown, Popover } from 'antd';
import { Plus } from 'lucide-react';
import { movedBefore } from '@features/voice-crew/block-order';
import {
  templateFromBlocks,
  type TemplateBlock,
} from '@features/voice-crew/template-blocks';
import type { VoiceIntentView } from '@shared/contracts/generated/bindings';
import { Block, type BlockChange } from './Block';
import { BlockInput } from './BlockInput';
import { ChoiceChip } from './ChoiceChip';
import { SlotSettings } from './SlotSettings';
import { useBlockDrag } from './useBlockDrag';
import styles from './CrewPage.module.scss';

/** A block being added, shown empty until something is written into it. */
type PendingBlock = 'words' | 'optional' | 'choice';

interface TemplateBlocksProps {
  blocks: TemplateBlock[];
  /** The action whose slots the sentence may name. */
  intent: VoiceIntentView;
  onChange: (template: string) => void;
}

/** A driver's sentence put together from blocks rather than typed marks. */
export const TemplateBlocks = observer(
  ({ blocks, intent, onChange }: TemplateBlocksProps) => {
    const { t } = useTranslation('main-app');
    const [pending, setPending] = useState<PendingBlock | null>(null);
    // A block just turned into a choice opens its options to add to.
    const [openChoice, setOpenChoice] = useState<number | null>(null);
    const write = (next: TemplateBlock[]) => onChange(templateFromBlocks(next));
    const replace = (index: number, block: TemplateBlock) =>
      write(blocks.map((current, at) => (at === index ? block : current)));
    const remove = (index: number) =>
      write(blocks.filter((_, at) => at !== index));
    const add = (block: TemplateBlock) => write([...blocks, block]);
    const drag = useBlockDrag(blocks.length, (from, before) =>
      write(movedBefore(blocks, from, before))
    );
    const addPending = (text: string) => {
      if (pending !== null && pending !== 'choice' && text.trim() !== '') {
        add({ kind: pending, text });
      }

      setPending(null);
    };
    const addChoice = (options: string[]) => {
      const choice = choiceBlock(options, false);

      if (choice) {
        add(choice);
      }

      setPending(null);
    };
    const makeChoice = (index: number, text: string, optional: boolean) => {
      replace(index, { kind: 'choice', options: [text], optional });
      setOpenChoice(index);
    };
    const changes = (block: TemplateBlock, index: number): BlockChange[] => {
      const optionalLabel = t('crewPage.blocks.makeOptional');
      const requiredLabel = t('crewPage.blocks.makeRequired');
      const choiceLabel = t('crewPage.blocks.makeChoice');

      if (block.kind === 'words') {
        return [
          {
            key: 'optional',
            label: optionalLabel,
            onClick: () =>
              replace(index, { kind: 'optional', text: block.text }),
          },
          {
            key: 'choice',
            label: choiceLabel,
            onClick: () => makeChoice(index, block.text, false),
          },
        ];
      }

      if (block.kind === 'optional') {
        return [
          {
            key: 'required',
            label: requiredLabel,
            onClick: () => replace(index, { kind: 'words', text: block.text }),
          },
          {
            key: 'choice',
            label: choiceLabel,
            onClick: () => makeChoice(index, block.text, true),
          },
        ];
      }

      if (block.kind === 'choice') {
        return [
          {
            key: 'optional',
            label: block.optional ? requiredLabel : optionalLabel,
            onClick: () =>
              replace(index, { ...block, optional: !block.optional }),
          },
          {
            key: 'words',
            label: t('crewPage.blocks.makeWords'),
            onClick: () =>
              replace(index, { kind: 'words', text: block.options[0] ?? '' }),
          },
        ];
      }

      return [
        {
          key: 'optional',
          label: block.optional ? requiredLabel : optionalLabel,
          onClick: () =>
            replace(index, { ...block, optional: !block.optional }),
        },
      ];
    };
    const addItems = [
      {
        key: 'words',
        label: t('crewPage.blocks.words'),
        onClick: () => setPending('words'),
      },
      {
        key: 'choice',
        label: t('crewPage.blocks.choice'),
        onClick: () => setPending('choice'),
      },
      {
        key: 'optional',
        label: t('crewPage.blocks.optional'),
        onClick: () => setPending('optional'),
      },
      ...intent.slots.map((slot) => ({
        key: `slot:${slot}`,
        label: t('crewPage.blocks.slot', { slot: `{${slot}}` }),
        onClick: () => add({ kind: 'slot' as const, slot }),
      })),
    ];

    if (blocks.length === 0 && pending === null) {
      return (
        <div className={styles.blocks}>
          <BlockInput
            wide
            value=""
            placeholder={t('crewPage.blocks.emptySentence')}
            onCommit={onChange}
          />
        </div>
      );
    }

    return (
      <div className={styles.blocks} ref={drag.listRef}>
        {blocks.map((block, index) => (
          <Block
            key={index}
            tone={block.kind === 'slot' ? 'value' : block.kind}
            optional={
              (block.kind === 'slot' || block.kind === 'choice') &&
              block.optional === true
            }
            drag={drag.block(index)}
            changes={changes(block, index)}
            onRemove={() => remove(index)}
          >
            {(block.kind === 'words' || block.kind === 'optional') && (
              <BlockInput
                value={block.text}
                onCommit={(text) =>
                  text.trim() === ''
                    ? remove(index)
                    : replace(index, { ...block, text })
                }
              />
            )}

            {block.kind === 'choice' && (
              <ChoiceChip
                options={block.options}
                initiallyOpen={openChoice === index}
                onCommit={(options) => {
                  const choice = choiceBlock(options, block.optional === true);

                  setOpenChoice(null);

                  if (choice) {
                    replace(index, choice);
                  } else {
                    remove(index);
                  }
                }}
              />
            )}

            {block.kind === 'slot' && (
              <Popover
                trigger="click"
                placement="bottomLeft"
                content={
                  <div className={styles.slotPopover}>
                    <Checkbox
                      checked={block.optional === true}
                      onChange={(event) =>
                        replace(index, {
                          ...block,
                          optional: event.target.checked,
                        })
                      }
                    >
                      {t('crewPage.blocks.slotOptional')}
                    </Checkbox>

                    <SlotSettings intent={intent} slot={block.slot} />
                  </div>
                }
              >
                <button type="button" className={styles.blockChip}>
                  {`{${block.slot}}`}
                </button>
              </Popover>
            )}
          </Block>
        ))}

        {(pending === 'words' || pending === 'optional') && (
          <div
            className={`${styles.block} ${pending === 'optional' ? styles.blockOptional : ''}`}
          >
            <BlockInput
              focusOnMount
              value=""
              placeholder={t('crewPage.blocks.newWord')}
              onCommit={addPending}
              onDone={() => setPending(null)}
            />
          </div>
        )}

        {pending === 'choice' && (
          <div className={`${styles.block} ${styles.blockChoice}`}>
            <ChoiceChip options={[]} initiallyOpen onCommit={addChoice} />
          </div>
        )}

        <Dropdown menu={{ items: addItems }} trigger={['click']}>
          <Button
            size="small"
            type="text"
            icon={<Plus size={14} />}
            aria-label={t('crewPage.blocks.add')}
          />
        </Dropdown>
      </div>
    );
  }
);

/**
 * The block a choice's options make: none is no block, one is a plain word —
 * or an optional one — more are a choice.
 */
const choiceBlock = (
  options: string[],
  optional: boolean
): TemplateBlock | null => {
  const kept = options.map((option) => option.trim()).filter(Boolean);

  if (kept.length === 0) {
    return null;
  }

  if (kept.length === 1) {
    return optional
      ? { kind: 'optional', text: kept[0] }
      : { kind: 'words', text: kept[0] };
  }

  return { kind: 'choice', options: kept, optional };
};
