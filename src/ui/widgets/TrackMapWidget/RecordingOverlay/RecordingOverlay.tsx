import { observer } from 'mobx-react-lite';

import styles from './RecordingOverlay.module.scss';
import { useSessionStore } from '@store/root-store-context';

const COMPLETE_PROGRESS = 1;

interface RecordingOverlayProps {
  isRecording: boolean;
  isWaitingForSF: boolean;
  progress: number;
}

export const RecordingOverlay = observer(
  ({ isRecording, isWaitingForSF, progress }: RecordingOverlayProps) => {
    const { sessionInfo } = useSessionStore();
    const trackName = sessionInfo?.trackDisplayName ?? '';

    // The backend reports a finished recording while this overlay is still
    // mounted only when the shape itself never reached this window — showing a
    // full progress bar there would read as a stuck recording.
    const isAwaitingShape =
      !isRecording && !isWaitingForSF && progress >= COMPLETE_PROGRESS;

    const getMessage = () => {
      if (isRecording) return 'Recording track...';
      if (isWaitingForSF) return 'Waiting for Start/Finish line...';
      if (isAwaitingShape) return 'Loading track map...';

      return 'Drive 1 full lap to record track';
    };

    return (
      <div className={styles.recordingOverlay}>
        <div className={styles.recordingTitle}>{trackName || 'Track Map'}</div>

        <div className={styles.recordingMessage}>{getMessage()}</div>

        {!isAwaitingShape && (
          <>
            <div className={styles.progressBarWrap}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className={styles.progressLabel}>
              {Math.round(progress * 100)}%
            </div>
          </>
        )}
      </div>
    );
  }
);
