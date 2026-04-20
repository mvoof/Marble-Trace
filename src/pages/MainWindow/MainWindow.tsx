import { useEffect, useState } from 'react';
import { Layout, Typography, theme, Menu } from 'antd';
import { ConfigProvider } from 'antd';
import { LayoutGrid, Settings } from 'lucide-react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { appSettingsStore } from '../../store/app-settings.store';
import { unitsStore } from '../../store/units.store';
import { ConnectionStatus } from './components/ConnectionStatus';
import { WidgetsPage } from './components/WidgetsPage';
import { SettingsPage } from './components/SettingsPage';
import styles from './MainWindow.module.scss';
import Logo from '../../assets/logo.svg?react';

const { Content, Header } = Layout;
const { Title } = Typography;

type PageKey = 'widgets' | 'settings';

const MENU_ITEMS = [
  { key: 'widgets', icon: <LayoutGrid size={16} />, label: 'Widgets' },
  { key: 'settings', icon: <Settings size={16} />, label: 'Settings' },
];

export const MainWindow = () => {
  const [activePage, setActivePage] = useState<PageKey>('widgets');

  useTelemetry();

  useEffect(() => {
    const init = async () => {
      await widgetSettingsStore.loadSettings();
      await unitsStore.loadSettings();
      await appSettingsStore.init();
    };
    init();

    return () => {
      appSettingsStore.dispose();
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

          <ConnectionStatus />
        </Header>

        <Layout>
          <Layout.Sider width={200} theme="dark" className={styles.sider}>
            <Menu
              mode="inline"
              selectedKeys={[activePage]}
              items={MENU_ITEMS}
              onSelect={({ key }) => setActivePage(key as PageKey)}
            />
          </Layout.Sider>

          <Content className={styles.content}>
            {activePage === 'widgets' && <WidgetsPage />}
            {activePage === 'settings' && <SettingsPage />}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};
