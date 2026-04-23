import { useEffect, useState } from 'react';
import { Layout, Typography, theme, ConfigProvider, Divider } from 'antd';
import { observer } from 'mobx-react-lite';
import { Settings } from 'lucide-react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { initMainSync } from '../../store/sync';
import { WidgetList } from './components/WidgetList';
import { WidgetSettings } from './components/WidgetSettings';
import { SettingsPage } from './components/SettingsPage';
import styles from './MainWindow.module.scss';
import Logo from '../../assets/logo.svg?react';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

export const MainWindow = observer(() => {
  const [selectedId, setSelectedId] = useState<string>('app-settings');

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
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: '#000000',
          colorBgContainer: '#0a0a0a',
          colorBgElevated: '#141414',
          colorPrimary: '#ffffff', // Back to White for general accents
          colorTextBase: '#ffffff',
          borderRadius: 4,
        },
        components: {
          Layout: {
            siderBg: '#050505',
            bodyBg: '#0a0a0a',
            headerBg: '#050505',
          },
          Card: {
            colorBgContainer: '#0a0a0a',
            colorBorderSecondary: 'rgba(255, 255, 255, 0.1)',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: 'rgba(255, 255, 255, 0.1)',
            itemSelectedColor: '#ffffff',
          },
          Divider: {
            colorSplit: 'rgba(255, 255, 255, 0.1)',
          },
          Switch: {
            colorPrimary: '#22c55e', // Keep Green ONLY for Switches
            colorPrimaryHover: '#4ade80',
          },
        },
      }}
    >
      <Layout className={styles.layout}>
        <Sider
          width={280}
          className={styles.sider}
          style={{ height: '100vh', overflowY: 'auto' }}
        >
          <div className={styles.sidebarHeader}>
            <Logo className={styles.logo} />
            <Title level={4} style={{ margin: 0 }}>
              Marble Trace
            </Title>
          </div>

          <div className={styles.sidebarContent}>
            <WidgetList selectedId={selectedId} onSelect={setSelectedId} />

            <Divider style={{ margin: '12px 0' }} />

            <div
              className={`${styles.settingsItem} ${
                selectedId === 'app-settings' ? styles.active : ''
              }`}
              onClick={() => setSelectedId('app-settings')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedId('app-settings');
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Settings size={18} />
              <Text>App Settings</Text>
            </div>
          </div>
        </Sider>

        <Content className={styles.content}>
          <div key={selectedId} className={styles.scrollContainer}>
            {selectedId === 'app-settings' ? (
              <SettingsPage />
            ) : (
              <WidgetSettings widgetId={selectedId} />
            )}
          </div>
        </Content>
      </Layout>
    </ConfigProvider>
  );
});
