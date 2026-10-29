import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from 'antd';
import { CircleCheck, CircleX, Mic, TriangleAlert } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import type { VoiceRecognisedView } from '@shared/contracts/generated/bindings';
import styles from './CrewPage.module.scss';

const PERCENT = 100;
const ICON_SIZE = 14;

interface RadioCheckProps {
  actionTitle: (id: string) => string;
  /** Opens a command the sentence called. */
  onOpen: (id: string) => void;
}

/**
 * The radio check: hold and say a sentence — the unsaved edits included —
 * or type one in the list, and see which command it calls, with what values
 * and how sure the ear was.
 */
export const RadioCheck = observer(
  ({ actionTitle, onOpen }: RadioCheckProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const release = () => {
      if (crew.testing) {
        crew.testPress(false);
      }
    };

    return (
      <div className={styles.radioCheck}>
        <Button
          icon={<Mic size={ICON_SIZE} />}
          type={crew.testing ? 'primary' : 'default'}
          disabled={!crew.voiceEnabled || !crew.ready}
          onPointerDown={() => crew.testPress(true)}
          onPointerUp={release}
          onPointerLeave={release}
        >
          {t('crewPage.voice.hold')}
        </Button>

        <div className={styles.radioCheckResult}>
          <TrialResult actionTitle={actionTitle} onOpen={onOpen} />

          {crew.dirty && crew.voiceEnabled && (
            <div className={styles.radioCheckNote}>
              {t('crewPage.check.draftNote')}
            </div>
          )}
        </div>
      </div>
    );
  }
);

/** What the last sentence tried called, or what the check is waiting for. */
const TrialResult = observer(({ actionTitle, onOpen }: RadioCheckProps) => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const trial = crew.trial;

  if (crew.testing) {
    return (
      <Typography.Text type="secondary">
        {t('crewPage.check.listening')}
      </Typography.Text>
    );
  }

  if (!crew.voiceEnabled && trial === null) {
    return (
      <Typography.Text type="secondary">
        {t('crewPage.check.voiceOff')}
      </Typography.Text>
    );
  }

  if (trial === null) {
    return (
      <Typography.Text type="secondary">
        {t('crewPage.check.idle')}
      </Typography.Text>
    );
  }

  if (trial.sentence === '') {
    return (
      <Typography.Text type="danger" className={styles.radioCheckLine}>
        <CircleX size={ICON_SIZE} />
        {t('crewPage.check.silence')}
      </Typography.Text>
    );
  }

  if (trial.heard.length === 0) {
    return (
      <Typography.Text type="danger" className={styles.radioCheckLine}>
        <CircleX size={ICON_SIZE} />
        {t('crewPage.check.unknown', { sentence: trial.sentence })}
      </Typography.Text>
    );
  }

  const unsure =
    trial.confidence !== null && trial.confidence < crew.confidenceThreshold;
  const percent =
    trial.confidence === null ? null : Math.round(trial.confidence * PERCENT);

  return (
    <>
      {trial.heard.map((heard, order) => (
        <button
          type="button"
          key={order}
          className={styles.radioCheckHeard}
          onClick={() => onOpen(heard.intent)}
        >
          <Typography.Text
            type={unsure ? 'warning' : 'success'}
            className={styles.radioCheckLine}
          >
            {unsure ? (
              <TriangleAlert size={ICON_SIZE} />
            ) : (
              <CircleCheck size={ICON_SIZE} />
            )}
            {t('crewPage.check.heard', {
              sentence: trial.sentence,
              action: actionTitle(heard.intent),
              slots: slotsText(heard),
            })}
          </Typography.Text>

          {percent !== null && (
            <span className={styles.radioCheckPercent}>
              {unsure
                ? t('crewPage.check.unsure', { percent })
                : t('crewPage.check.sure', { percent })}
            </span>
          )}
        </button>
      ))}
    </>
  );
});

const slotsText = (heard: VoiceRecognisedView): string =>
  heard.slots.map((slot) => ` · {${slot.slot}} = ${slot.value}`).join('');
