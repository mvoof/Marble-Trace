import { useState, useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Card,
  Typography,
  Space,
  Input,
  Button,
  Tag,
  Switch,
  Flex,
} from 'antd';
import type { InputRef } from 'antd';
import { appSettingsStore } from '../../../../store/app-settings.store';

const { Title, Text } = Typography;

export const SettingsPage = observer(() => {
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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

  useEffect(() => {
    if (recording) {
      inputRef.current?.focus();
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [recording, handleKeyDown]);

  const applyHotkey = async () => {
    if (pendingKey) {
      await appSettingsStore.setDragHotkey(pendingKey);
      setPendingKey(null);
    }
  };

  return (
    <Flex vertical gap={16}>
      <Title level={4} style={{ margin: 0 }}>
        Settings
      </Title>

      <Card title="Widget Drag Mode">
        <Flex vertical gap={16}>
          <Space>
            <Switch
              checked={appSettingsStore.dragMode}
              onChange={() => appSettingsStore.toggleDragMode()}
            />
            <Text type="secondary">
              {appSettingsStore.dragMode ? 'Enabled' : 'Disabled'}
            </Text>
          </Space>

          <Flex vertical gap={8}>
            <Text>Hotkey</Text>
            <Space>
              <Tag color="blue">{appSettingsStore.dragHotkey}</Tag>
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
                />
              ) : (
                <Button onClick={() => setRecording(true)}>
                  Record Hotkey
                </Button>
              )}
              {pendingKey && (
                <Button type="primary" onClick={applyHotkey}>
                  Apply
                </Button>
              )}
            </Space>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
});
