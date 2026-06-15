import { observer } from 'mobx-react-lite';

import styles from './RecordingOverlay.module.scss';
import { useSessionStore } from '@store/root-store-context';

interface RecordingOverlayProps {
  isRecording: boolean;
  isWaitingForSF: boolean;
  progress: number;
}

export const RecordingOverlay = observer(
  ({ isRecording, isWaitingForSF, progress }: RecordingOverlayProps) => {
    const { sessionInfo } = useSessionStore();
    const trackName = sessionInfo?.trackDisplayName ?? '';

    const getMessage = () => {
      if (isRecording) return 'Recording track...';
      if (isWaitingForSF) return 'Waiting for Start/Finish line...';

      return 'Drive 1 full lap to record track';
    };

    return (
      <div className={styles.recordingOverlay}>
        <div className={styles.recordingTitle}>{trackName || 'Track Map'}</div>

        <div className={styles.recordingMessage}>{getMessage()}</div>

        <div className={styles.progressBarWrap}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className={styles.progressLabel}>
          {Math.round(progress * 100)}%
        </div>
      </div>
    );
  }
);
