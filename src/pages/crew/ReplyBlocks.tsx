import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { pluralForms, pluralSample } from '@features/voice-crew/plural-message';
import { movedBefore } from '@features/voice-crew/block-order';
import {
  replyFromBlocks,
  spacedReplyBlocks,
  type ReplyBlock,
} from '@features/voice-crew/reply-blocks';
import { Block, type BlockChange, type BlockTone } from './Block';
import { BlockInput } from './BlockInput';
import { ChoiceChip } from './ChoiceChip';
import { useBlockDrag } from './useBlockDrag';
import { PluralDialog, ValueInsert } from './ValueInsert';
import styles from './CrewPage.module.scss';

interface ReplyBlocksProps {
  language: string;
  blocks: ReplyBlock[];
  /** The values the reply may name. */
  values: string[];
  /** A question's reply, which may also read any of the sim's variables. */
  simValues: boolean;
  onChange: (text: string) => void;
}

type PluralBlock = Extract<ReplyBlock, { kind: 'plural' }>;

/** A block being added, shown empty until something is written into it. */
type PendingBlock = 'text' | 'optional' | 'choice';

const TONES: Record<ReplyBlock['kind'], BlockTone> = {
  text: 'words',
  value: 'value',
  plural: 'value',
  message: 'value',
  choice: 'choice',
  optional: 'optional',
};

/**
 * A reply as blocks: its text, the values the engineer fills in, the word
 * that agrees with a number shown as it sounds — "1 литр · 3 литра" — and the
 * ways a part can be put or left out, the engineer saying one each time. One
 * menu adds any of them.
 */
export const ReplyBlocks = observer(
  ({ language, blocks, values, simValues, onChange }: ReplyBlocksProps) => {
    const { t } = useTranslation('main-app');
    const [editing, setEditing] = useState<number | null>(null);
    const [pending, setPending] = useState<PendingBlock | null>(null);
    // A block just turned into a choice opens its options to add to.
    const [openChoice, setOpenChoice] = useState<number | null>(null);
    const write = (next: ReplyBlock[]) =>
      onChange(replyFromBlocks(spacedReplyBlocks(next, language)));
    const replace = (index: number, block: ReplyBlock) =>
      write(blocks.map((current, at) => (at === index ? block : current)));
    const remove = (index: number) =>
      write(blocks.filter((_, at) => at !== index));
    const valueName = (value: string) =>
      t(`crewPage.values.names.${value}`, { defaultValue: value });
    const editingBlock = editing === null ? null : blocks[editing];
    const drag = useBlockDrag(blocks.length, (from, before) =>
      write(movedBefore(blocks, from, before))
    );
    const reply = replyFromBlocks(blocks);
    const addPending = (text: string) => {
      if (pending === 'text' && text.trim() !== '') {
        write([...blocks, { kind: 'text', text }]);
      } else if (pending === 'optional' && text.trim() !== '') {
        write([...blocks, { kind: 'optional', text }]);
      }

      setPending(null);
    };
    const addChoice = (options: string[]) => {
      const choice = choiceBlock(options, false);

      if (choice) {
        write([...blocks, choice]);
      }

      setPending(null);
    };
    const makeChoice = (index: number, text: string, optional: boolean) => {
      replace(index, { kind: 'choice', options: [text.trim()], optional });
      setOpenChoice(index);
    };
    const changes = (block: ReplyBlock, index: number): BlockChange[] => {
      const optionalLabel = t('crewPage.blocks.makeOptional');
      const requiredLabel = t('crewPage.blocks.makeRequired');
      const choiceLabel = t('crewPage.blocks.makeChoice');

      if (block.kind === 'text') {
        return [
          {
            key: 'optional',
            label: optionalLabel,
            onClick: () =>
              replace(index, { kind: 'optional', text: block.text.trim() }),
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
            onClick: () => replace(index, { kind: 'text', text: block.text }),
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
              replace(index, { kind: 'text', text: block.options[0] ?? '' }),
          },
        ];
      }

      return [
        {
          key: 'optional',
          label: optionalLabel,
          onClick: () =>
            replace(index, {
              kind: 'optional',
              text: replyFromBlocks([block]),
            }),
        },
      ];
    };

    if (blocks.length === 0 && pending === null) {
      return (
        <div className={styles.blocks}>
          <BlockInput
            wide
            value=""
            placeholder={t('crewPage.blocks.emptyReply')}
            onCommit={onChange}
          />
        </div>
      );
    }

    return (
      <div className={styles.blocks} ref={drag.listRef}>
        {blocks.map((block, index) => {
          // The spaces between values are kept as blocks but not shown.
          if (block.kind === 'text' && block.text.trim() === '') {
            return null;
          }

          return (
            <Block
              key={index}
              tone={TONES[block.kind]}
              optional={block.kind === 'choice' && block.optional === true}
              drag={drag.block(index)}
              changes={changes(block, index)}
              onRemove={() => remove(index)}
            >
              {(block.kind === 'text' || block.kind === 'optional') && (
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
                    const choice = choiceBlock(
                      options,
                      block.optional === true
                    );

                    setOpenChoice(null);

                    if (choice) {
                      replace(index, choice);
                    } else {
                      remove(index);
                    }
                  }}
                />
              )}

              {block.kind === 'value' && (
                <span className={styles.blockChip}>
                  {valueName(block.value)}
                </span>
              )}

              {block.kind === 'plural' && (
                <button
                  type="button"
                  className={styles.blockChip}
                  onClick={() => setEditing(index)}
                >
                  {pluralSamples(language, block)}
                </button>
              )}

              {block.kind === 'message' && (
                <span className={`${styles.blockChip} ${styles.mono}`}>
                  {block.text}
                </span>
              )}
            </Block>
          );
        })}

        {(pending === 'text' || pending === 'optional') && (
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

        <ValueInsert
          language={language}
          values={values}
          simValues={simValues}
          leadingItems={[
            {
              key: 'text',
              label: t('crewPage.blocks.reply.text'),
              onClick: () => setPending('text'),
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
          ]}
          onInsert={(inserted) =>
            onChange(`${reply.trimEnd()} ${inserted}`.trim())
          }
        />

        {editing !== null && editingBlock?.kind === 'plural' && (
          <PluralDialog
            language={language}
            value={editingBlock.value}
            label={valueName(editingBlock.value)}
            initialWords={editingBlock.words}
            okText={t('crewPage.blocks.apply')}
            onClose={() => setEditing(null)}
            onInsert={(text) => {
              const before = replyFromBlocks(blocks.slice(0, editing));
              const after = replyFromBlocks(blocks.slice(editing + 1));

              onChange(`${before}${text}${after}`);
              setEditing(null);
            }}
          />
        )}
      </div>
    );
  }
);

/**
 * The block a choice's options make: none is no block, one is plain text —
 * or an optional part — more are a choice.
 */
const choiceBlock = (
  options: string[],
  optional: boolean
): ReplyBlock | null => {
  const kept = options.map((option) => option.trim()).filter(Boolean);

  if (kept.length === 0) {
    return null;
  }

  if (kept.length === 1) {
    return optional
      ? { kind: 'optional', text: kept[0] }
      : { kind: 'text', text: kept[0] };
  }

  return { kind: 'choice', options: kept, optional };
};

/** The agreeing word as it sounds with a number for each form: "1 литр · 3 литра". */
const pluralSamples = (language: string, block: PluralBlock): string => {
  const numberFormat = new Intl.NumberFormat(language);

  return pluralForms(language)
    .filter((form) => block.words[form] !== undefined)
    .map(
      (form) =>
        `${numberFormat.format(pluralSample(language, form))} ${block.words[form]}`
    )
    .join(' · ');
};
