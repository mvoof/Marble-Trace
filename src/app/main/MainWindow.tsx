import { useEffect, useState } from 'react';
import { Layout, ConfigProvider, theme, App as AntdApp } from 'antd';
import { observer } from 'mobx-react-lite';
import { initMainSync } from '@store/sync/sync-init';
import { WidgetList } from './components/WidgetList/WidgetList';
import { WidgetWorkbench } from './components/WidgetWorkbench/WidgetWorkbench';
import { LayoutEditor } from './components/LayoutEditor/LayoutEditor';
import { SettingsPage } from './components/SettingsPage/SettingsPage';
import { AppHeader, type AppSection } from './components/AppHeader/AppHeader';
import { AppFooter } from './components/AppFooter/AppFooter';
import { UpdateBanner } from './components/UpdateBanner/UpdateBanner';
import styles from './MainWindow.module.scss';
import { useStore, useSimStore } from '@store/root-store-context';

const { Content } = Layout;

export const MainWindow = observer(() => {
  const simStore = useSimStore();
  const root = useStore();

  const [activeSection, setActiveSection] = useState<AppSection>('layouts');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

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
      <AntdApp style={{ height: '100%' }}>
        <Layout className={styles.layout}>
          <AppHeader
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          <UpdateBanner />

          <Content className={styles.content}>
            {activeSection === 'settings' && (
              <div className={styles.scrollContainer} key="settings">
                <div
                  className={`${styles.contentInner} ${styles.animateFadeIn}`}
                >
                  <SettingsPage />
                </div>
              </div>
            )}

            {activeSection === 'layouts' && (
              <div
                className={`${styles.sectionContainer} ${styles.animateFadeIn}`}
                key="layouts"
              >
                <LayoutEditor />
              </div>
            )}

            {activeSection === 'widgets' && (
              <div
                className={`${styles.sectionContainer} ${styles.animateFadeIn}`}
                key="widgets"
              >
                <div className={styles.widgetsSection}>
                  <div className={styles.widgetCatalog}>
                    <div className={styles.catalogTitle}>Widget Modules</div>
                    <WidgetList
                      selectedId={selectedWidgetId}
                      onSelect={setSelectedWidgetId}
                    />
                  </div>

                  <div className={styles.widgetWorkbench}>
                    <WidgetWorkbench widgetId={selectedWidgetId} />
                  </div>
                </div>
              </div>
            )}
          </Content>

          <AppFooter />
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
});
