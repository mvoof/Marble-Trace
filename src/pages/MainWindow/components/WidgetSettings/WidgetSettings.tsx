import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import {
  InputNumber,
  Slider,
  Typography,
  Card,
  Row,
  Col,
  ColorPicker,
  Flex,
  Button,
  Tag,
} from 'antd';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { appSettingsStore } from '../../../../store/app-settings.store';

const { Title, Text } = Typography;

export const WidgetSettings = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    if (!widgetId) {
      return <Text type="secondary">Select a widget to configure</Text>;
    }

    const widget = widgetSettingsStore.getWidget(widgetId);

    if (!widget) {
      return <Text type="secondary">Widget not found</Text>;
    }

    return (
      <Card>
        <Title level={5}>{widget.label}</Title>
        <Flex vertical gap={16}>
          <Row gutter={16}>
            <Col span={12}>
              <Text>X</Text>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.x}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'x', v)
                }
              />
            </Col>

            <Col span={12}>
              <Text>Y</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={widget.y}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'y', v)
                }
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Text>Width</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={widget.width}
                min={100}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'width', v)
                }
              />
            </Col>

            <Col span={12}>
              <Text>Height</Text>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.height}
                min={50}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'height', v)
                }
              />
            </Col>
          </Row>

          <Flex vertical>
            <Text>Scale: {widget.scale.toFixed(1)}</Text>

            <Slider
              min={0.5}
              max={3}
              step={0.1}
              value={widget.scale}
              onChange={(v) =>
                widgetSettingsStore.updateField(widgetId, 'scale', v)
              }
            />
          </Flex>

          <Flex vertical>
            <Text>Opacity: {Math.round((widget.opacity ?? 0.8) * 100)}%</Text>

            <Slider
              min={0.1}
              max={1}
              step={0.05}
              value={widget.opacity ?? 0.8}
              onChange={(v) =>
                widgetSettingsStore.updateField(widgetId, 'opacity', v)
              }
            />
          </Flex>

          <Flex vertical>
            <Text>Background Color</Text>

            <ColorPicker
              value={widget.backgroundColor ?? '#000000'}
              onChange={(color) =>
                widgetSettingsStore.updateField(
                  widgetId,
                  'backgroundColor',
                  color.toHexString()
                )
              }
            />
          </Flex>

          <HotkeyRecorder widgetId={widgetId} currentHotkey={widget.hotkey} />
        </Flex>
      </Card>
    );
  }
);

const HotkeyRecorder = ({
  widgetId,
  currentHotkey,
}: {
  widgetId: string;
  currentHotkey: string;
}) => {
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();

      const parts: string[] = [];

      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');

      const key = e.key;

      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        setPendingKey(parts.join('+'));
        setRecording(false);
      }
    },
    [recording]
  );

  const applyHotkey = async () => {
    if (!pendingKey) return;

    widgetSettingsStore.updateField(widgetId, 'hotkey', pendingKey);
    await appSettingsStore.registerWidgetHotkey(widgetId, pendingKey);

    setPendingKey(null);
  };

  const clearHotkey = async () => {
    widgetSettingsStore.updateField(widgetId, 'hotkey', '');
    await appSettingsStore.unregisterWidgetHotkey(widgetId);

    setPendingKey(null);
  };

  return (
    <Flex vertical gap={8}>
      <Text>
        Toggle Hotkey:{' '}
        {currentHotkey ? <Tag color="blue">{currentHotkey}</Tag> : 'None'}
      </Text>

      <Flex gap={8}>
        <Button
          size="small"
          type={recording ? 'primary' : 'default'}
          danger={recording}
          onClick={() => {
            setRecording(!recording);
            setPendingKey(null);
          }}
          onKeyDown={handleKeyDown}
        >
          {recording ? 'Press a key...' : 'Record Hotkey'}
        </Button>

        {pendingKey && (
          <>
            <Tag color="green">{pendingKey}</Tag>

            <Button size="small" type="primary" onClick={applyHotkey}>
              Apply
            </Button>
          </>
        )}

        {currentHotkey && (
          <Button size="small" danger onClick={clearHotkey}>
            Clear
          </Button>
        )}
      </Flex>
    </Flex>
  );
};
