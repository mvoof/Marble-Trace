import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Space, Button, Input } from 'antd';
import type { InputRef } from 'antd';
import styles from './HotkeyRecorder.module.scss';

interface HotkeyRecorderProps {
  currentHotkey: string;
  onApply: (newHotkey: string) => void;
  onClear?: () => void;
  label?: string;
}

export const HotkeyRecorder = ({
  currentHotkey,
  onApply,
  onClear,
}: HotkeyRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (recording) {
      inputRef.current?.focus();
    }
  }, [recording]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;

      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];

      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');

      const key = e.key;

      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
        parts.push(normalizedKey);
        setPendingKey(parts.join('+'));
        setRecording(false);
      }
    },
    [recording]
  );

  const applyHotkey = () => {
    if (pendingKey) {
      onApply(pendingKey);
      setPendingKey(null);
    }
  };

  const clearHotkey = () => {
    if (onClear) {
      onClear();
    } else {
      onApply('');
    }
    setPendingKey(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.hotkeyDisplay}>
        <div className={styles.keyBadge}>{currentHotkey || 'None'}</div>
        {pendingKey && (
          <>
            <div className={styles.arrow}>→</div>
            <div className={styles.pendingBadge}>{pendingKey}</div>
          </>
        )}
      </div>
      <Space>
        {recording ? (
          <Input
            ref={inputRef}
            readOnly
            placeholder="Press a key combination..."
            className={styles.recordingInput}
            onBlur={() => setRecording(false)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <Button size="small" onClick={() => setRecording(true)}>
            {currentHotkey ? 'Rebind' : 'Record'}
          </Button>
        )}
        {pendingKey && (
          <Button
            size="small"
            type="primary"
            onClick={() => {
              void applyHotkey();
            }}
          >
            Apply
          </Button>
        )}
        {currentHotkey && !recording && (
          <Button
            size="small"
            danger
            onClick={() => {
              void clearHotkey();
            }}
          >
            Clear
          </Button>
        )}
      </Space>
    </div>
  );
};
