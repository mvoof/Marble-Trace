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
  Segmented,
  message,
} from 'antd';
import type { InputRef } from 'antd';
import { appSettingsStore } from '../../../../store/app-settings.store';
import { unitsStore, type UnitSystem } from '../../../../store/units.store';
import { downloadSnapshot } from '../../../../storybook/capture-snapshot';

const { Title, Text } = Typography;
const isDev = import.meta.env.DEV;

export const SettingsPage = observer(() => {
  const [messageApi, contextHolder] = message.useMessage();
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

  const handleCaptureSnapshot = () => {
    downloadSnapshot('iracing');
    messageApi.success('Snapshot saved — place the JSON in test-data/');
  };

  return (
    <Flex vertical gap={16}>
      {contextHolder}

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
                <Button
                  type="primary"
                  onClick={() => {
                    void applyHotkey();
                  }}
                >
                  Apply
                </Button>
              )}
            </Space>
          </Flex>
        </Flex>
      </Card>
      <Card title="Game Integration">
        <Flex vertical gap={8}>
          <Space>
            <Switch
              checked={appSettingsStore.hideWidgetsWhenGameClosed}
              onChange={(v) => {
                void appSettingsStore.setHideWidgetsWhenGameClosed(v);
              }}
            />

            <Text>Hide widgets when iRacing is not running</Text>
          </Space>

          <Text type="secondary">
            Widgets will automatically show when iRacing connects and hide when
            it disconnects.
          </Text>
        </Flex>
      </Card>

      <Card title="Units">
        <Flex vertical gap={8}>
          <Text>Measurement System</Text>

          <Segmented
            options={[
              { label: 'Metric (km/h, °C, L)', value: 'metric' },
              { label: 'Imperial (mph, °F, gal)', value: 'imperial' },
            ]}
            value={unitsStore.system}
            onChange={(value) => {
              void unitsStore.setSystem(value as UnitSystem);
            }}
          />
        </Flex>
      </Card>
      {isDev && (
        <Card title="Dev Tools">
          <Flex vertical gap={8}>
            <Text type="secondary">
              Capture current telemetry state as a JSON snapshot for Storybook
              fixtures. Place the downloaded file in <code>test-data/</code>.
            </Text>

            <Button onClick={handleCaptureSnapshot}>Capture Snapshot</Button>
          </Flex>
        </Card>
      )}
    </Flex>
  );
});
