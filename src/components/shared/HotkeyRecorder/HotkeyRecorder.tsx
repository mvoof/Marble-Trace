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

const normalizeTauriKey = (e: React.KeyboardEvent): string => {
  if (e.code === 'Enter') return 'RETURN';
  if (e.code.startsWith('Key')) return e.key.toUpperCase();
  if (e.code.startsWith('Digit')) return e.key;
  return e.code.toUpperCase();
};

export const HotkeyRecorder = ({
  currentHotkey,
  onApply,
  onClear,
  label,
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

      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const mainKey = normalizeTauriKey(e);
      if (!mainKey) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('CONTROL');
      if (e.shiftKey) parts.push('SHIFT');
      if (e.altKey) parts.push('ALT');
      if (e.metaKey) parts.push('SUPER');
      parts.push(mainKey);

      setPendingKey(parts.join('+'));
      setRecording(false);
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
      {label && <span className={styles.label}>{label}</span>}
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
          <Button size="small" type="primary" onClick={applyHotkey}>
            Apply
          </Button>
        )}
        {currentHotkey && !recording && (
          <Button size="small" danger onClick={clearHotkey}>
            Clear
          </Button>
        )}
      </Space>
    </div>
  );
};
