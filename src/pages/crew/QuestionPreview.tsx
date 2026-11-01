import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Input } from 'antd';
import { Play, RefreshCw } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import styles from './CrewPage.module.scss';

interface QuestionPreviewProps {
  questionId: string;
  /**
   * The slot the question's phrase names its car by — `number`, `position`
   * or `classPosition`; `null` for a question that needs no car named.
   */
  carSlot: string | null;
}

/**
 * What the question would answer now, from the session the app is connected
 * to — the sim's or a replayed tape's — before the pack is saved.
 */
export const QuestionPreview = observer(
  ({ questionId, carSlot }: QuestionPreviewProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    // Text, not a number: a car number keeps its leading zeros.
    const [car, setCar] = useState('');
    const preview =
      crew.questionPreview?.questionId === questionId
        ? crew.questionPreview.result
        : null;
    const ask = (play: boolean) => {
      const typed = car.trim();

      void crew.previewQuestion(
        questionId,
        carSlot !== null && typed !== '' ? typed : null,
        play
      );
    };

    return (
      <div className={styles.actionSection}>
        <div className={styles.fieldTitle}>
          {t('crewPage.questions.preview.title')}
        </div>

        <div className={styles.fieldDesc}>
          {t('crewPage.questions.preview.desc')}
        </div>

        <div className={styles.actions}>
          {carSlot !== null && (
            <Input
              size="small"
              className={styles.previewCar}
              inputMode="numeric"
              value={car}
              placeholder={t(`crewPage.questions.preview.car.${carSlot}`)}
              onChange={(event) => setCar(event.target.value)}
            />
          )}

          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            disabled={crew.busy}
            onClick={() => ask(false)}
          >
            {t('crewPage.questions.preview.show')}
          </Button>

          <Button
            size="small"
            icon={<Play size={12} />}
            disabled={crew.busy}
            onClick={() => ask(true)}
          >
            {t('crewPage.questions.preview.listen')}
          </Button>
        </div>

        {preview?.kind === 'said' &&
          preview.texts.map((text, order) => (
            <div key={order} className={styles.previewSaid}>
              {t('crewPage.questions.preview.said', { text })}
            </div>
          ))}

        {preview && preview.kind !== 'said' && (
          <div className={styles.fieldHint}>
            {t(`crewPage.questions.preview.${preview.kind}`)}
          </div>
        )}
      </div>
    );
  }
);
