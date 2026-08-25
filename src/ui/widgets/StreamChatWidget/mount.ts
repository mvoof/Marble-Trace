import type { WidgetMount } from '@ui/widgets/widget-mount';
import { STREAM_CHAT_MANIFEST } from './manifest';
import { StreamChatWidget } from './StreamChatWidget';

export const mount: WidgetMount = {
  id: STREAM_CHAT_MANIFEST.id,
  component: StreamChatWidget,
};
