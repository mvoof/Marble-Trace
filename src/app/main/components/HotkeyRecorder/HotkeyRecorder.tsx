import React, { useState, useCallback, useRef } from 'react';
import { Space, Button, Input } from 'antd';
import type { InputRef } from 'antd';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('main-app');
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingFocusRef = useRef(false);

  const inputCallbackRef = useCallback((node: InputRef | null) => {
    if (node && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      node.focus();
    }
  }, []);

  const startRecording = () => {
    pendingFocusRef.current = true;
    setRecording(true);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;

      e.preventDefault();
      e.stopPropagation();

      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const mainKey = normalizeTauriKey(e);

      if (!mainKey) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Control');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Super');

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
        <div className={styles.keyBadge}>
          {currentHotkey || t('hotkeyRecorder.none')}
        </div>

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
            ref={inputCallbackRef}
            readOnly
            placeholder={t('hotkeyRecorder.pressKeyCombination')}
            className={styles.recordingInput}
            onBlur={() => setRecording(false)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <Button size="small" onClick={startRecording}>
            {currentHotkey
              ? t('hotkeyRecorder.rebind')
              : t('hotkeyRecorder.record')}
          </Button>
        )}

        {pendingKey && (
          <Button size="small" type="primary" onClick={applyHotkey}>
            {t('hotkeyRecorder.apply')}
          </Button>
        )}

        {currentHotkey && !recording && (
          <Button size="small" danger onClick={clearHotkey}>
            {t('hotkeyRecorder.clear')}
          </Button>
        )}
      </Space>
    </div>
  );
};
