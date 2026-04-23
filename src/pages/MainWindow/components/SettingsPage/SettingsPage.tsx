import { observer } from 'mobx-react-lite';
import {
  Card,
  Typography,
  Space,
  Button,
  Switch,
  Flex,
  Segmented,
  message,
} from 'antd';
import { appSettingsStore } from '../../../../store/app-settings.store';
import { unitsStore, type UnitSystem } from '../../../../store/units.store';
import { downloadSnapshot } from '../../../../storybook/capture-snapshot';
import { HotkeyRecorder } from '../../../../components/shared/HotkeyRecorder';

const { Title, Text } = Typography;
const isDev = import.meta.env.DEV;

export const SettingsPage = observer(() => {
  const [messageApi, contextHolder] = message.useMessage();

  const handleCaptureSnapshot = () => {
    downloadSnapshot('iracing');
    messageApi.success('Snapshot saved — place the JSON in test-data/');
  };

  return (
    <Flex vertical gap={24}>
      {contextHolder}

      <div>
        <Title level={3} style={{ margin: 0 }}>
          App Settings
        </Title>
        <Text type="secondary">Global Application Configuration</Text>
      </div>

      <Flex vertical gap={24}>
        <section>
          <Title level={5} style={{ marginBottom: 12 }}>
            Widget Display
          </Title>
          <Card size="small">
            <Flex vertical gap={16}>
              <Flex vertical gap={4}>
                <Space>
                  <Switch
                    checked={appSettingsStore.hideAllWidgets}
                    onChange={(v) => {
                      void appSettingsStore.setHideAllWidgets(v);
                    }}
                  />

                  <Text>Hide all widgets</Text>
                </Space>

                <Text type="secondary" style={{ fontSize: 12 }}>
                  Global toggle to quickly hide or show all enabled widgets.
                </Text>
              </Flex>

              <HotkeyRecorder
                label="Toggle Visibility Hotkey"
                currentHotkey={appSettingsStore.hideAllWidgetsHotkey}
                onApply={(key) => appSettingsStore.setHideAllWidgetsHotkey(key)}
              />
            </Flex>
          </Card>
        </section>

        <section>
          <Title level={5} style={{ marginBottom: 12 }}>
            Widget Drag Mode
          </Title>
          <Card size="small">
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

              <HotkeyRecorder
                label="Drag Mode Hotkey"
                currentHotkey={appSettingsStore.dragHotkey}
                onApply={(key) => appSettingsStore.setDragHotkey(key)}
              />
            </Flex>
          </Card>
        </section>

        <section>
          <Title level={5} style={{ marginBottom: 12 }}>
            Game Integration
          </Title>
          <Card size="small">
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

              <Text type="secondary" style={{ fontSize: 12 }}>
                Widgets will automatically show when iRacing connects and hide
                when it disconnects.
              </Text>
            </Flex>
          </Card>
        </section>

        <section>
          <Title level={5} style={{ marginBottom: 12 }}>
            Units
          </Title>
          <Card size="small">
            <Flex vertical gap={12}>
              <Text type="secondary">Measurement System</Text>

              <Segmented
                block
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
        </section>

        {isDev && (
          <section>
            <Title level={5} style={{ marginBottom: 12 }}>
              Developer Tools
            </Title>
            <Card size="small">
              <Flex vertical gap={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Capture current telemetry state as a JSON snapshot for
                  Storybook fixtures. Place the downloaded file in{' '}
                  <code>test-data/</code>.
                </Text>

                <Button onClick={handleCaptureSnapshot}>
                  Capture Snapshot
                </Button>
              </Flex>
            </Card>
          </section>
        )}
      </Flex>
    </Flex>
  );
});
