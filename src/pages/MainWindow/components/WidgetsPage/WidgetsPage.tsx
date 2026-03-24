import { useState } from 'react';
import { Layout } from 'antd';
import { WidgetList } from '../WidgetList';
import { WidgetSettings } from '../WidgetSettings';
import styles from './WidgetsPage.module.scss';

const { Sider, Content } = Layout;

export const WidgetsPage = () => {
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);

  return (
    <Layout className={styles.layout}>
      <Sider width={260} theme="dark" className={styles.sider}>
        <WidgetList onSelect={setSelectedWidget} />
      </Sider>
      <Content className={styles.content}>
        <WidgetSettings widgetId={selectedWidget} />
      </Content>
    </Layout>
  );
};
