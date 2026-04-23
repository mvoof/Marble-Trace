import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Flex, Typography, Space, Tag, Button, Input } from 'antd';
import type { InputRef } from 'antd';

const { Text } = Typography;

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
  label = 'Hotkey',
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

      // Prevent default browser behavior for recorded keys
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
    <Flex vertical gap={8}>
      <Text>{label}</Text>
      <Space>
        <Tag color="blue">{currentHotkey || 'None'}</Tag>
        {pendingKey && (
          <>
            <Text type="secondary">→</Text>
            <Tag color="green">{pendingKey}</Tag>
          </>
        )}
      </Space>
      <Space>
        {recording ? (
          <Input
            ref={inputRef}
            readOnly
            placeholder="Press a key combination..."
            style={{ width: 250 }}
            onBlur={() => setRecording(false)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <Button onClick={() => setRecording(true)}>
            {currentHotkey ? 'Change Hotkey' : 'Record Hotkey'}
          </Button>
        )}
        {pendingKey && (
          <Button
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
            danger
            onClick={() => {
              void clearHotkey();
            }}
          >
            Clear
          </Button>
        )}
      </Space>
    </Flex>
  );
};
