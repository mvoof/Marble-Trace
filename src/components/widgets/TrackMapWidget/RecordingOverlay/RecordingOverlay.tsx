import styles from './RecordingOverlay.module.scss';

interface RecordingOverlayProps {
  trackName: string;
  isRecording: boolean;
  progress: number;
}

export const RecordingOverlay = ({
  trackName,
  isRecording,
  progress,
}: RecordingOverlayProps) => (
  <div className={styles.recordingOverlay}>
    <div className={styles.recordingTitle}>{trackName || 'Track Map'}</div>

    <div className={styles.recordingMessage}>
      {isRecording ? 'Recording track...' : 'Drive 1 full lap to record track'}
    </div>

    <div className={styles.progressBarWrap}>
      <div
        className={styles.progressBarFill}
        style={{ width: `${progress * 100}%` }}
      />
    </div>

    <div className={styles.progressLabel}>{Math.round(progress * 100)}%</div>
  </div>
);
