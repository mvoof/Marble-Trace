import { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Mentions, Tooltip } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { parseReplyBlocks } from '@features/voice-crew/reply-blocks';
import { questionAnswerList } from '@features/voice-crew/voice-crew.store';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import type { VoiceIntentView } from '@shared/contracts/generated/bindings';
import { ReplyBlocks } from './ReplyBlocks';
import { useMistakeText } from './useMistakeText';
import styles from './CrewPage.module.scss';

/** What opens the field list while typing an answer. */
const FIELD_OPEN = '{';
/** A field name ends at a space or a brace: past one, the list closes. */
const OUTSIDE_FIELD_NAME = /[\s{}]/;

/**
 * The answer the driver was last in: a field tag goes to its cursor, or to
 * its end when it is edited as blocks.
 */
interface ActiveField {
  element: HTMLTextAreaElement | null;
  phraseKey: string;
  index: number;
}

interface QuestionAnswersProps {
  intent: VoiceIntentView;
  questionId: string;
}

/**
 * A question's answers, as blocks or as text: the answer itself, what is
 * said with no car and with a value missing — and the fields they may name,
 * one click from the answer last worked on.
 */
export const QuestionAnswers = observer(
  ({ intent, questionId }: QuestionAnswersProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const activeField = useRef<ActiveField | null>(null);
    const target = crew.findQuestion(questionId)?.target ?? null;
    const { car, session } = crew.questionFields;
    const fields = target === null ? session : [...car, ...session];
    const phrases = (crew.pack?.phrases ?? []).filter(
      (phrase) =>
        intent.replies.includes(phrase.key) &&
        (target !== null || questionAnswerList(phrase.key) !== 'noCar')
    );
    const insertField = (field: string) => {
      const answerKey = intent.replies[0];
      const active = activeField.current;
      const phraseKey = active?.phraseKey ?? answerKey;
      const phrase = phrases.find((entry) => entry.key === phraseKey);

      if (!phrase) {
        return;
      }

      if (phrase.variants.length === 0) {
        crew.addVariant(phrase.key);
      }

      const index =
        active && active.index < phrase.variants.length ? active.index : 0;
      const text = phrase.variants[index]?.text ?? '';
      const element = active?.element?.isConnected ? active.element : null;
      const tag = `${FIELD_OPEN}${field}}`;

      if (!element) {
        crew.setVariantText(
          phrase.key,
          index,
          `${text.trimEnd()} ${tag}`.trim()
        );

        return;
      }

      const start = element.selectionStart;
      const end = element.selectionEnd;

      crew.setVariantText(
        phrase.key,
        index,
        `${text.slice(0, start)}${tag}${text.slice(end)}`
      );
      requestAnimationFrame(() => {
        element.focus();
        element.setSelectionRange(start + tag.length, start + tag.length);
      });
    };

    return (
      <div className={styles.actionSection}>
        <div className={styles.fieldTitle}>
          {t('crewPage.commands.answers')}
        </div>

        {phrases.map((phrase) => {
          const list = questionAnswerList(phrase.key) ?? 'answers';

          return (
            <div key={phrase.key} className={styles.phrase}>
              <div className={styles.phraseTitle}>
                {t(`crewPage.questions.lists.${list}.title`)}
              </div>

              <div className={styles.fieldHint}>
                {t(`crewPage.questions.lists.${list}.desc`)}
              </div>

              {phrase.variants.map((variant, index) => (
                <AnswerRow
                  key={index}
                  phraseKey={phrase.key}
                  index={index}
                  text={variant.text}
                  fields={fields}
                  onFocus={(element) => {
                    activeField.current = {
                      element,
                      phraseKey: phrase.key,
                      index,
                    };
                  }}
                />
              ))}

              <Button
                size="small"
                icon={<Plus size={12} />}
                onClick={() => crew.addVariant(phrase.key)}
              >
                {t('crewPage.phrases.addVariant')}
              </Button>
            </div>
          );
        })}

        <div className={styles.fieldSheet}>
          <div className={styles.fieldHint}>
            {t('crewPage.questions.fields.desc')}
          </div>

          <FieldGroup
            title={t('crewPage.questions.fields.car')}
            fields={target === null ? [] : car}
            empty={t('crewPage.questions.fields.carNeedsTarget')}
            onInsert={insertField}
          />

          <FieldGroup
            title={t('crewPage.questions.fields.session')}
            fields={session}
            empty=""
            onInsert={insertField}
          />
        </div>
      </div>
    );
  }
);

interface AnswerRowProps {
  phraseKey: string;
  index: number;
  text: string;
  fields: string[];
  /** The answer was entered: its text field, or `null` for its blocks. */
  onFocus: (element: HTMLTextAreaElement | null) => void;
}

/**
 * One way to say an answer: blocks, or text where `{` lists the fields it
 * may name.
 */
const AnswerRow = observer(
  ({ phraseKey, index, text, fields, onFocus }: AnswerRowProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const { mistakeText } = useMistakeText();
    const check = crew.variantChecks.get(`${phraseKey}#${index}`);
    // A line typed as text stays text until it is left, or it would turn
    // into blocks under the cursor and drop the focus.
    const [typing, setTyping] = useState(false);
    const blocks = crew.blockEditing && !typing ? parseReplyBlocks(text) : null;
    const fieldName = (field: string) =>
      t(`crewPage.questions.fields.names.${field}`, { defaultValue: field });
    const setText = (next: string) =>
      crew.setVariantText(phraseKey, index, next);

    return (
      <div className={styles.variant}>
        <div className={styles.variantRow}>
          {blocks ? (
            <div
              className={styles.variantText}
              onPointerDownCapture={() => onFocus(null)}
            >
              <ReplyBlocks
                language={crew.packLanguage}
                blocks={blocks}
                values={fields}
                valueName={fieldName}
                onChange={setText}
              />
            </div>
          ) : (
            <Mentions
              className={styles.variantText}
              autoSize
              prefix={FIELD_OPEN}
              split=""
              value={text}
              status={check?.error ? 'error' : undefined}
              options={fields.map((field) => ({
                value: `${field}}`,
                label: `${FIELD_OPEN}${field}}`,
              }))}
              validateSearch={(search) => !OUTSIDE_FIELD_NAME.test(search)}
              onFocus={(event) => {
                setTyping(true);
                onFocus(event.currentTarget);
              }}
              onBlur={() => setTyping(false)}
              onChange={setText}
            />
          )}

          <Button
            type="text"
            icon={<Trash2 size={14} />}
            onClick={() => crew.removeVariant(phraseKey, index)}
            aria-label={t('crewPage.phrases.removeVariant')}
          />
        </div>

        {check?.error && (
          <div className={styles.checkError}>
            {t('crewPage.phrases.mistake', {
              message: mistakeText(check.error),
            })}
          </div>
        )}
      </div>
    );
  }
);

interface FieldGroupProps {
  title: string;
  fields: string[];
  /** Said in place of the fields when there are none. */
  empty: string;
  onInsert: (field: string) => void;
}

const FieldGroup = observer(
  ({ title, fields, empty, onInsert }: FieldGroupProps) => {
    const { t } = useTranslation('main-app');

    return (
      <div className={styles.fieldSheetGroup}>
        <span className={styles.fieldSheetGroupTitle}>{title}</span>

        {fields.length === 0 && (
          <span className={styles.fieldHint}>{empty}</span>
        )}

        {fields.map((field) => (
          <Tooltip
            key={field}
            title={t(`crewPage.questions.fields.names.${field}`, {
              defaultValue: '',
            })}
          >
            <button
              type="button"
              className={styles.fieldTag}
              // The answer field keeps the focus and the cursor it had.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsert(field)}
            >
              {`${FIELD_OPEN}${field}}`}
            </button>
          </Tooltip>
        ))}
      </div>
    );
  }
);
