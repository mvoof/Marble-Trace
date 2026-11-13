import { useEffect } from 'react';
import { Layout, ConfigProvider, theme, App as AntdApp } from 'antd';
import { observer } from 'mobx-react-lite';
import { initMainSync } from '@app/sync/main/main-sync';
import { WidgetsPage } from '@pages/widgets/WidgetsPage';
import { LayoutEditor } from '@pages/layouts/LayoutEditor';
import { SettingsPage } from '@pages/settings/SettingsPage';
import { CrewPage } from '@pages/crew/CrewPage';
import { HomePage } from '@pages/home/HomePage';
import { HotkeysPage } from '@pages/hotkeys/HotkeysPage';
import { ConnectionsPage } from '@pages/connections/ConnectionsPage';
import { DataPage } from '@pages/data/DataPage';
import { CrewLeaveDialog } from '@pages/crew/CrewLeaveDialog';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { AppHeader } from './AppHeader/AppHeader';
import { UpdateBanner } from './UpdateBanner/UpdateBanner';
import { SettingsLockBanner } from './SettingsLockBanner/SettingsLockBanner';
import styles from './MainWindow.module.scss';
import { useSimStore } from '@entities/sim/sim-context';
import { useMainRoot } from '@app/roots/main-root-context';

const { Content } = Layout;

export const MainWindow = observer(() => {
  const simStore = useSimStore();
  const root = useMainRoot();
  const navigation = useMainNavigationStore();

  useEffect(() => {
    void simStore.startStream();

    return () => {
      void simStore.stopStream();
    };
  }, [simStore]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      const result = await initMainSync(root);

      if (!isMounted) {
        result();
      } else {
        cleanup = result;
      }
    };

    void init();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [root]);

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
          fontFamily:
            "'Exo 2', 'Noto Sans SC', system-ui, Avenir, Helvetica, Arial, sans-serif",
        },
        components: {
          // colorPrimary is near-white, so primary buttons need dark text/icon
          // or the icon blends into the active button background.
          Button: {
            primaryColor: '#15161a',
          },
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
      <AntdApp style={{ height: '100%' }}>
        <Layout className={styles.layout}>
          <AppHeader />

          <CrewLeaveDialog
            open={navigation.isAskingToLeave}
            onStay={() => navigation.stay()}
            onLeave={() => navigation.leave()}
          />

          <SettingsLockBanner />

          <UpdateBanner />

          <Content className={styles.content}>
            {navigation.section === 'home' && (
              <div className={styles.scrollContainer} key="home">
                <div
                  className={`${styles.contentInner} ${styles.animateFadeIn}`}
                >
                  <HomePage />
                </div>
              </div>
            )}

            {navigation.section === 'data' && (
              <div
                className={`${styles.pageContainer} ${styles.animateFadeIn}`}
                key="data"
              >
                <DataPage />
              </div>
            )}

            {navigation.section === 'connections' && (
              <div
                className={`${styles.pageContainer} ${styles.animateFadeIn}`}
                key="connections"
              >
                <ConnectionsPage />
              </div>
            )}

            {navigation.section === 'hotkeys' && (
              <div className={styles.scrollContainer} key="hotkeys">
                <div
                  className={`${styles.contentInner} ${styles.animateFadeIn}`}
                >
                  <HotkeysPage />
                </div>
              </div>
            )}

            {navigation.section === 'settings' && (
              <div
                className={`${styles.pageContainer} ${styles.animateFadeIn}`}
                key="settings"
              >
                <SettingsPage />
              </div>
            )}

            {navigation.section === 'crew' && (
              <div
                className={`${styles.pageContainer} ${styles.animateFadeIn}`}
                key="crew"
              >
                <CrewPage />
              </div>
            )}

            {navigation.section === 'layouts' && (
              <div
                className={`${styles.sectionContainer} ${styles.animateFadeIn}`}
                key="layouts"
              >
                <LayoutEditor
                  mode={navigation.layoutsMode}
                  onModeChange={(mode) => navigation.setLayoutsMode(mode)}
                />
              </div>
            )}

            {navigation.section === 'widgets' && (
              <div
                className={`${styles.pageContainer} ${styles.animateFadeIn}`}
                key="widgets"
              >
                <WidgetsPage />
              </div>
            )}
          </Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
});
