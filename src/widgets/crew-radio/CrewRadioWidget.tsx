import { observer } from 'mobx-react-lite';
import { Mic } from 'lucide-react';
import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { CrewRadioLineRow } from './CrewRadioLineRow';
import { useCrewRadioWidgetStore } from './crew-radio.store';
import styles from './CrewRadioWidget.module.scss';

/** What the plate says with nothing on the air — seen only while placing it. */
const IDLE_TEXT = 'Standing by';

/**
 * The voice crew's radio: what the driver said, what the engineer answered,
 * and push-to-talk while it is held. Off the air the widget is taken off
 * screen by WidgetAutoHideStore a moment after the last line; the quiet plate
 * is what the layout editor shows.
 */
export const CrewRadioWidget = observer(() => {
  const { lines, isListening } = useCrewRadioWidgetStore();
  const isQuiet = lines.length === 0 && !isListening;

  return (
    <WidgetPanel minWidth={0} gap={0} fitContent className={styles.root}>
      {lines.map((line) => (
        <CrewRadioLineRow key={line.id} line={line} />
      ))}

      {isListening && (
        <div className={`${styles.line} ${styles.driver}`} data-on-air="true">
          <div className={styles.header}>
            <Mic className={styles.mic} aria-hidden="true" />
            <span className={styles.speaker}>You</span>
          </div>

          <div className={`${styles.text} ${styles.quietText}`}>Listening…</div>
        </div>
      )}

      {isQuiet && (
        <div className={`${styles.line} ${styles.engineer}`}>
          <div className={styles.header}>
            <span className={styles.speaker}>Engineer</span>
          </div>

          <div className={`${styles.text} ${styles.quietText}`}>
            {IDLE_TEXT}
          </div>
        </div>
      )}
    </WidgetPanel>
  );
});
