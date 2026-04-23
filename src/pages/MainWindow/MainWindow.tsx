import { useEffect, useState } from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
import { observer } from 'mobx-react-lite';
import { Settings, Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTelemetry } from '../../hooks/useTelemetry';
import { initMainSync } from '../../store/sync';
import { WidgetList } from './components/WidgetList';
import { WidgetSettings } from './components/WidgetSettings';
import { SettingsPage } from './components/SettingsPage';
import { RandomGlitchCanvas } from '../../components/shared/BackgroundAnimation/RandomGlitchCanvas';
import styles from './MainWindow.module.scss';
import Logo from '../../assets/logo.svg?react';

const { Content, Sider } = Layout;

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

  const handleMinimize = () => {
    void getCurrentWindow().minimize();
  };

  const handleMaximize = () => {
    void getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    void getCurrentWindow().close();
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: '#0d0e12',
          colorBgContainer: '#15161a',
          colorBgElevated: '#1d1f25',
          colorPrimary: '#e0e0e0',
          colorTextBase: '#e0e0e0',
          colorTextDescription: '#8b8e98',
          borderRadius: 4,
          fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#111216',
            bodyBg: '#0d0e12',
          },
          Switch: {
            colorPrimary: '#e0e0e0',
            colorPrimaryHover: '#ffffff',
            colorTextQuaternary: '#15161a',
            handleBg: '#5e626d',
          },
          Segmented: {
            itemSelectedBg: '#2a2c32',
            itemSelectedColor: '#ffffff',
            itemColor: '#8b8e98',
            itemHoverColor: '#e0e0e0',
            trackBg: '#0d0e12',
          },
          Input: {
            colorBgContainer: '#0d0e12',
            colorBorder: '#2a2c32',
            colorTextPlaceholder: '#5e626d',
          },
          InputNumber: {
            colorBgContainer: '#0d0e12',
            colorBorder: '#2a2c32',
          },
          Select: {
            colorBgContainer: '#0d0e12',
            colorBorder: '#2a2c32',
          },
        },
      }}
    >
      <Layout className={styles.layout}>
        {/* Window Title Bar */}
        <div className={styles.titleBar}>
          <div className={styles.titleBarLeft}>
            <Logo className={styles.smallLogo} />
            <span className={styles.titleText}>Marble Trace System UI</span>
          </div>
          <div className={styles.titleBarRight}>
            <button
              className={styles.controlButton}
              onClick={handleMinimize}
              title="Minimize"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleMaximize}
              title="Maximize"
            >
              <Square size={13} strokeWidth={2.5} />
            </button>
            <button
              className={`${styles.controlButton} ${styles.close}`}
              onClick={handleClose}
              title="Close"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className={styles.mainContainer}>
          <Sider width={320} className={styles.sider}>
            <div className={styles.sidebarHeader}>
              <div className={styles.logoContainer}>
                <Logo className={styles.logo} />
              </div>
              <div className={styles.headerText}>
                <span className={styles.brandName}>Marble Trace</span>
              </div>
            </div>

            <div className={styles.sidebarContent}>
              <div className={styles.sectionTitle}>Widget Modules</div>
              <WidgetList selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            <div className={styles.sidebarFooter}>
              <button
                className={`${styles.settingsItem} ${
                  selectedId === 'app-settings' ? styles.active : ''
                }`}
                onClick={() => setSelectedId('app-settings')}
              >
                <Settings
                  size={16}
                  className={styles.settingsIcon}
                  strokeWidth={2}
                />
                <span className={styles.settingsLabel}>Global Settings</span>
              </button>
            </div>
          </Sider>

          <Content className={styles.content}>
            <RandomGlitchCanvas />
            <div className={styles.scrollContainer} key={selectedId}>
              <div className={`${styles.contentInner} ${styles.animateFadeIn}`}>
                {selectedId === 'app-settings' ? (
                  <SettingsPage />
                ) : (
                  <WidgetSettings widgetId={selectedId} />
                )}
              </div>
            </div>
          </Content>
        </div>
      </Layout>
    </ConfigProvider>
  );
});
