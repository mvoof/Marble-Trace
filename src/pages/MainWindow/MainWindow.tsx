import { useEffect, useState } from 'react';
import {
  Layout,
  Typography,
  theme,
  Menu,
  Space,
  Switch,
  ConfigProvider,
} from 'antd';
import { observer } from 'mobx-react-lite';
import { LayoutGrid, Settings, Eye, EyeOff } from 'lucide-react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { appSettingsStore } from '../../store/app-settings.store';
import { initMainSync } from '../../store/sync';
import { ConnectionStatus } from './components/ConnectionStatus';
import { WidgetsPage } from './components/WidgetsPage';
import { SettingsPage } from './components/SettingsPage';
import styles from './MainWindow.module.scss';
import Logo from '../../assets/logo.svg?react';

const { Content, Header, Sider } = Layout;
const { Title, Text } = Typography;

type PageKey = 'widgets' | 'settings';

const MENU_ITEMS = [
  { key: 'widgets', icon: <LayoutGrid size={16} />, label: 'Widgets' },
  { key: 'settings', icon: <Settings size={16} />, label: 'Settings' },
];

export const MainWindow = observer(() => {
  const [activePage, setActivePage] = useState<PageKey>('widgets');

  useTelemetry();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const init = async () => {
      cleanup = await initMainSync();
    };
    void init();

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout className={styles.layout}>
        <Header className={styles.header}>
          <div className={styles.headerTitleWrapper}>
            <Logo className={styles.logo} />

            <Title level={4} style={{ margin: 0 }}>
              Marble Trace
            </Title>
          </div>

          <Space size={24}>
            <Space>
              {appSettingsStore.hideAllWidgets ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
              <Text>Hide All</Text>
              <Switch
                checked={appSettingsStore.hideAllWidgets}
                onChange={(v) => {
                  void appSettingsStore.setHideAllWidgets(v);
                }}
              />
            </Space>

            <ConnectionStatus />
          </Space>
        </Header>

        <Layout>
          <Sider width={200} theme="dark" className={styles.sider}>
            <Menu
              mode="inline"
              selectedKeys={[activePage]}
              items={MENU_ITEMS}
              onSelect={({ key }) => setActivePage(key as PageKey)}
            />
          </Sider>

          <Content className={styles.content}>
            {activePage === 'widgets' && <WidgetsPage />}
            {activePage === 'settings' && <SettingsPage />}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
});
