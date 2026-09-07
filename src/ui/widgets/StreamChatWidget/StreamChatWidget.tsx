import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { StreamChatWidgetSettings } from '@/types/widget-settings';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { ChatBanner } from './ChatBanner/ChatBanner';
import { ChatFooter } from './ChatFooter/ChatFooter';
import { ChatMessageList } from './ChatMessageList/ChatMessageList';

import styles from './StreamChatWidget.module.scss';

export const StreamChatWidget = observer(() => {
  const settings = useWidgetSettings<StreamChatWidgetSettings>('stream-chat');

  return (
    <WidgetPanel className={styles.chat} gap={0}>
      {settings.showBanner && <ChatBanner />}
      <ChatMessageList />
      {settings.showFooter && <ChatFooter />}
    </WidgetPanel>
  );
});
