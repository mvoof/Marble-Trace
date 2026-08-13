import type { WheelEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import {
  useAppSettingsStore,
  useStreamChatWidgetStore,
} from '@store/root-store-context';
import { ScrollIndicator } from '@ui/shared/ScrollIndicator/ScrollIndicator';
import { ChatMessageRow } from '../ChatMessageRow/ChatMessageRow';

import styles from './ChatMessageList.module.scss';

// One wheel notch moves a small block of messages, matching the standings feel.
const WHEEL_STEP_MESSAGES = 3;

export const ChatMessageList = observer(() => {
  const chatWidget = useStreamChatWidgetStore();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('widgets');

  // Drag mode also lets the mouse through, but there the wheel belongs to
  // widget placement, not to reading chat.
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!appSettings.interactMode) {
      return;
    }

    chatWidget.scrollByRows(-Math.sign(event.deltaY) * WHEEL_STEP_MESSAGES);
  };

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
    <div className={styles.list} onWheel={handleWheel}>
      {chatWidget.visibleMessages.map((message) => (
        <ChatMessageRow key={message.id} message={message} />
      ))}

      {/* Off the overlay's normal look: the bar is only useful while the mouse
          can reach the widget, or as the reminder that the feed is parked in
          history. */}
      <ScrollIndicator
        thumb={chatWidget.scrollThumb}
        visible={appSettings.interactMode || chatWidget.isScrolled}
      />
    </div>
  );
});
