import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Input, Popover } from 'antd';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { parseTemplateBlocks } from '@features/voice-crew/template-blocks';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { VOICE_QUESTION_PREFIX } from '@shared/contracts/generated/backend-constants';
import type { VoiceIntentView } from '@shared/contracts/generated/bindings';
import { PhraseEditor } from './PhraseEditor';
import { QuestionSteps } from './QuestionSteps';
import { SlotSettings } from './SlotSettings';
import { TemplateBlocks } from './TemplateBlocks';
import styles from './CrewPage.module.scss';

/**
 * One action: what it does, the sentences that call it, and the engineer's
 * answers. What a value's words are and what an unsaid one does open from
 * the value itself.
 */
export const ActionCard = observer(
  ({ intent }: { intent: VoiceIntentView }) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const phrases = (crew.pack?.phrases ?? []).filter((phrase) =>
      intent.replies.includes(phrase.key)
    );
    const questionName = crew.questionName(intent.id);

    return (
      <div className={styles.actionCard}>
        {questionName === null ? (
          <div className={styles.fieldDesc}>
            {t(`crewPage.actions.${intent.id}.desc`, { defaultValue: '' })}
          </div>
        ) : (
          <QuestionHeader intentId={intent.id} name={questionName} />
        )}

        <div className={styles.actionSection}>
          <div className={styles.fieldTitle}>{t('crewPage.commands.says')}</div>

          {intent.templates.map((template, index) => (
            <TemplateRow
              key={index}
              intent={intent}
              index={index}
              template={template}
            />
          ))}

          <div className={styles.actions}>
            <Button
              size="small"
              icon={<Plus size={12} />}
              onClick={() => crew.addTemplate(intent.id)}
            >
              {t('crewPage.commands.addTemplate')}
            </Button>

            {intent.slots.length > 0 && (
              <span className={styles.slotsLabel}>
                {t('crewPage.commands.slotsTitle')}
              </span>
            )}

            {intent.slots.map((slot) => (
              <Popover
                key={slot}
                trigger="click"
                placement="bottomLeft"
                content={
                  <div className={styles.slotPopover}>
                    <SlotSettings intent={intent} slot={slot} />
                  </div>
                }
              >
                <Button size="small" icon={<Settings2 size={12} />}>
                  {`{${slot}}`}
                </Button>
              </Popover>
            ))}
          </div>
        </div>

        {questionName !== null && (
          <QuestionSteps
            questionId={intent.id.slice(VOICE_QUESTION_PREFIX.length)}
          />
        )}

        <div className={styles.actionSection}>
          <div className={styles.fieldTitle}>
            {t('crewPage.commands.answers')}
          </div>

          {intent.id.startsWith('pit.') && (
            <div className={styles.fieldHint}>
              {t('crewPage.commands.sharedAnswers')}
            </div>
          )}

          {questionName !== null && (
            <div className={styles.fieldHint}>
              {t('crewPage.questions.noData')}
            </div>
          )}

          {phrases.map((phrase) => (
            <PhraseEditor key={phrase.key} phrase={phrase} />
          ))}
        </div>
      </div>
    );
  }
);

/** A question's own name, and the way to delete it. */
const QuestionHeader = observer(
  ({ intentId, name }: { intentId: string; name: string }) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const id = intentId.slice(VOICE_QUESTION_PREFIX.length);

    return (
      <div className={styles.variantRow}>
        <Input
          className={styles.variantText}
          value={name}
          placeholder={t('crewPage.questions.name')}
          onChange={(event) => crew.renameQuestion(id, event.target.value)}
        />

        <Button
          danger
          icon={<Trash2 size={14} />}
          onClick={() => crew.removeQuestion(id)}
        >
          {t('crewPage.questions.remove')}
        </Button>
      </div>
    );
  }
);

interface TemplateRowProps {
  intent: VoiceIntentView;
  index: number;
  template: string;
}

const TemplateRow = observer(
  ({ intent, index, template }: TemplateRowProps) => {
    const intentId = intent.id;
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const check = crew.templateChecks.get(`${intentId}#${index}`);
    const hidden = check ? check.sentences - check.examples.length : 0;
    // A line typed as text stays text until it is left, or it would turn
    // into blocks under the cursor and drop the focus.
    const [typing, setTyping] = useState(false);
    const blocks =
      crew.blockEditing && !typing ? parseTemplateBlocks(template) : null;

    return (
      <div className={styles.variant}>
        <div className={styles.variantRow}>
          {blocks ? (
            <TemplateBlocks
              blocks={blocks}
              intent={intent}
              onChange={(next) => crew.setTemplate(intentId, index, next)}
            />
          ) : (
            <Input
              className={`${styles.variantText} ${styles.mono}`}
              value={template}
              status={check?.error ? 'error' : undefined}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onChange={(event) =>
                crew.setTemplate(intentId, index, event.target.value)
              }
            />
          )}

          <Button
            icon={<Trash2 size={14} />}
            onClick={() => crew.removeTemplate(intentId, index)}
            aria-label={t('crewPage.commands.removeTemplate')}
          />
        </div>

        {check?.error && (
          <div className={styles.checkError}>
            {t('crewPage.commands.mistake', { message: check.error })}
          </div>
        )}

        {check && check.missingWords.length > 0 && (
          <div className={styles.checkError}>
            {t('crewPage.commands.missingWords', {
              words: check.missingWords.join(', '),
            })}
          </div>
        )}

        {check && !check.error && check.examples.length > 0 && (
          <div className={styles.fieldHint}>
            {check.examples.map((example) => `«${example}»`).join(' · ')}
            {hidden > 0 && ` ${t('crewPage.commands.more', { count: hidden })}`}
          </div>
        )}
      </div>
    );
  }
);
