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
    <Flex vertical gap={16}>
      {contextHolder}

      <Title level={4} style={{ margin: 0 }}>
        Settings
      </Title>

      <Card title="Widget Display">
        <Flex vertical gap={16}>
          <Flex vertical gap={8}>
            <Space>
              <Switch
                checked={appSettingsStore.hideAllWidgets}
                onChange={(v) => {
                  void appSettingsStore.setHideAllWidgets(v);
                }}
              />

              <Text>Hide all widgets</Text>
            </Space>

            <Text type="secondary">
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

          <HotkeyRecorder
            label="Drag Mode Hotkey"
            currentHotkey={appSettingsStore.dragHotkey}
            onApply={(key) => appSettingsStore.setDragHotkey(key)}
          />
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
