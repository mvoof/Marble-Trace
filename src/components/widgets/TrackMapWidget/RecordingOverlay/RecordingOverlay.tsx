import { useRef, useImperativeHandle, forwardRef } from 'react';
import styles from './RecordingOverlay.module.scss';

export interface RecordingOverlayHandle {
  setProgress: (progress: number) => void;
  setRecording: (recording: boolean) => void;
}

interface RecordingOverlayProps {
  trackName: string;
  isRecording: boolean;
  progress: number;
}

export const RecordingOverlay = forwardRef<
  RecordingOverlayHandle,
  RecordingOverlayProps
>(({ trackName, isRecording, progress }, ref) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setProgress: (p: number) => {
      if (fillRef.current) {
        fillRef.current.style.width = `${p * 100}%`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = `${Math.round(p * 100)}%`;
      }
    },
    setRecording: (recording: boolean) => {
      if (messageRef.current) {
        messageRef.current.textContent = recording
          ? 'Recording track...'
          : 'Drive 1 full lap to record track';
      }
    },
  }));

  return (
    <div className={styles.recordingOverlay}>
      <div className={styles.recordingTitle}>{trackName || 'Track Map'}</div>

      <div ref={messageRef} className={styles.recordingMessage}>
        {isRecording
          ? 'Recording track...'
          : 'Drive 1 full lap to record track'}
      </div>

      <div className={styles.progressBarWrap}>
        <div
          ref={fillRef}
          className={styles.progressBarFill}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div ref={labelRef} className={styles.progressLabel}>
        {Math.round(progress * 100)}%
      </div>
    </div>
  );
});

RecordingOverlay.displayName = 'RecordingOverlay';
