import { observer } from 'mobx-react-lite';

import type { StreamChatWidgetSettings } from '@/types/widget-settings';
import { WidgetPanel } from '@/components/WidgetPanel/WidgetPanel';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { ChatBanner } from './ChatBanner/ChatBanner';
import { ChatFooter } from './ChatFooter/ChatFooter';
import { ChatMessageList } from './ChatMessageList/ChatMessageList';

import styles from './StreamChatWidget.module.scss';

export const StreamChatWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<StreamChatWidgetSettings>('stream-chat');

  return (
    <WidgetPanel className={styles.chat} gap={0}>
      {settings.showBanner && <ChatBanner />}
      <ChatMessageList />
      {settings.showFooter && <ChatFooter />}
    </WidgetPanel>
  );
});
