import { observer } from 'mobx-react-lite';

import { useTelemetryInspectorStore } from '@features/telemetry-inspector/telemetry-inspector-context';
import styles from './TelemetryInspectorSection.module.scss';

/**
 * The session YAML as iRacing wrote it, one numbered line per line of the
 * document. A filter narrows it to the matching lines and keeps their numbers.
 */
export const RawSessionText = observer(() => {
  const inspector = useTelemetryInspectorStore();

  return (
    <div className={styles.rows}>
      {inspector.rawSessionLines.map((line) => (
        <div key={line.number} className={styles.textLine}>
          <span className={styles.lineNumber}>{line.number}</span>
          <span className={styles.lineText}>{line.text}</span>
        </div>
      ))}
    </div>
  );
});
