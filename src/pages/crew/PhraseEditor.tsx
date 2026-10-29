import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Input, Tooltip } from 'antd';
import type { BadgeProps } from 'antd';
import { Play, Plus, Trash2 } from 'lucide-react';
import { parseReplyBlocks } from '@features/voice-crew/reply-blocks';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { VOICE_QUESTION_PREFIX } from '@shared/contracts/generated/backend-constants';
import type { VoicePhraseView } from '@shared/contracts/generated/bindings';
import { ReplyBlocks } from './ReplyBlocks';
import { ValueInsert } from './ValueInsert';
import styles from './CrewPage.module.scss';

const STATUS_BADGES: Record<string, BadgeProps['status']> = {
  generated: 'success',
  dynamic: 'processing',
  missing: 'warning',
};

/**
 * One thing the crew says: when it says it and its variants — each read back
 * with sample values, so a mistake in the text shows before anything is saved
 * or heard.
 */
export const PhraseEditor = observer(
  ({ phrase }: { phrase: VoicePhraseView }) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const isQuestion = crew.questionName(phrase.key) !== null;

    return (
      <div className={styles.phrase}>
        <div className={styles.phraseTitle}>
          {isQuestion
            ? t('crewPage.questions.answers')
            : t(`crewPage.replies.${phrase.key}`, { defaultValue: phrase.key })}
        </div>

        {phrase.variants.map((variant, index) => (
          <VariantRow
            key={index}
            phrase={phrase}
            index={index}
            text={variant.text}
            status={variant.status}
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
  }
);

interface VariantRowProps {
  phrase: VoicePhraseView;
  index: number;
  text: string;
  status: string;
}

const VariantRow = observer(
  ({ phrase, index, text, status }: VariantRowProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const check = crew.variantChecks.get(`${phrase.key}#${index}`);
    const simValues = phrase.key.startsWith(VOICE_QUESTION_PREFIX);
    // A line typed as text stays text until it is left, or it would turn
    // into blocks under the cursor and drop the focus.
    const [typing, setTyping] = useState(false);
    const blocks = crew.blockEditing && !typing ? parseReplyBlocks(text) : null;
    const setText = (next: string) =>
      crew.setVariantText(phrase.key, index, next);

    return (
      <div className={styles.variant}>
        <div className={styles.variantRow}>
          {blocks ? (
            <ReplyBlocks
              language={crew.packLanguage}
              blocks={blocks}
              values={phrase.values}
              simValues={simValues}
              onChange={setText}
            />
          ) : (
            <>
              <Input
                className={styles.variantText}
                value={text}
                status={check?.error ? 'error' : undefined}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                onChange={(event) => setText(event.target.value)}
              />

              <ValueInsert
                language={crew.packLanguage}
                values={phrase.values}
                simValues={simValues}
                onInsert={(inserted) =>
                  setText(`${text.trimEnd()} ${inserted}`.trim())
                }
              />
            </>
          )}

          <Tooltip title={t(`crewPage.phrases.status.${status}`)}>
            <Badge
              className={styles.variantStatus}
              status={STATUS_BADGES[status] ?? 'default'}
            />
          </Tooltip>

          <Tooltip
            title={
              crew.dirty
                ? t('crewPage.phrases.playSaveFirst')
                : t('crewPage.phrases.play')
            }
          >
            <Button
              type="text"
              icon={<Play size={14} />}
              disabled={crew.dirty}
              onClick={() => crew.preview(phrase.key, index)}
            />
          </Tooltip>

          <Button
            type="text"
            icon={<Trash2 size={14} />}
            onClick={() => crew.removeVariant(phrase.key, index)}
            aria-label={t('crewPage.phrases.removeVariant')}
          />
        </div>

        {check?.error && (
          <div className={styles.checkError}>
            {t('crewPage.phrases.mistake', { message: check.error })}
          </div>
        )}

        {check && !check.error && check.sayings > 1 && (
          <div className={styles.fieldHint}>
            {t('crewPage.phrases.soundsWays', {
              count: check.sayings,
              samples: check.samples.join(' · '),
            })}
          </div>
        )}

        {check &&
          !check.error &&
          check.sayings <= 1 &&
          phrase.values.length > 0 && (
            <div className={styles.fieldHint}>
              {t('crewPage.phrases.sounds', {
                samples: check.samples.join(' · '),
              })}
            </div>
          )}
      </div>
    );
  }
);
