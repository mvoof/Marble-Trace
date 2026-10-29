import { observer } from 'mobx-react-lite';
import { Check, Mic, X } from 'lucide-react';

import type {
  CrewRadioLine,
  CrewRadioResult,
  CrewRadioSpeaker,
} from '@entities/crew-radio/crew-radio.store';
import styles from './CrewRadioWidget.module.scss';

const SPEAKER_LABEL: Record<CrewRadioSpeaker, string> = {
  driver: 'You',
  engineer: 'Engineer',
};

const SPEAKER_CLASS: Record<CrewRadioSpeaker, string> = {
  driver: styles.driver,
  engineer: styles.engineer,
};

const ResultMark = observer(({ result }: { result: CrewRadioResult }) => {
  if (result === 'ok') {
    return <Check className={styles.resultOk} aria-label="Done" />;
  }

  if (result === 'failed') {
    return <X className={styles.resultFailed} aria-label="Not done" />;
  }

  return null;
});

/** One line on the radio: who said it, what, and a command's ✓ / ✗. */
export const CrewRadioLineRow = observer(
  ({ line }: { line: CrewRadioLine }) => (
    <div
      className={`${styles.line} ${SPEAKER_CLASS[line.speaker]}`}
      data-on-air={line.onAir}
    >
      <div className={styles.header}>
        {line.onAir && <Mic className={styles.mic} aria-hidden="true" />}
        <span className={styles.speaker}>{SPEAKER_LABEL[line.speaker]}</span>
        <ResultMark result={line.result} />
      </div>

      <div className={styles.text}>{line.text}</div>
    </div>
  )
);
