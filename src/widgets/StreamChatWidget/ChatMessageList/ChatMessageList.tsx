import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStreamChatWidgetStore } from '@store/root-store-context';
import { ChatMessageRow } from '../ChatMessageRow/ChatMessageRow';

import styles from './ChatMessageList.module.scss';

export const ChatMessageList = observer(() => {
  const chatWidget = useStreamChatWidgetStore();
  const { t } = useTranslation('widgets');

  if (chatWidget.isIdle) {
    return (
      <div className={styles.list}>
        <span className={styles.empty}>
          {t('streamChat.waitingForMessages')}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {chatWidget.visibleMessages.map((message) => (
        <ChatMessageRow key={message.id} message={message} />
      ))}
    </div>
  );
});
