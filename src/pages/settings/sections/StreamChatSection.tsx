import { observer } from 'mobx-react-lite';

import { ChatCommandsCard } from '@features/twitch-auth/ChatCommandsCard/ChatCommandsCard';
import { StreamChatSourceCard } from '@features/twitch-auth/StreamChatSourceCard/StreamChatSourceCard';

export const StreamChatSection = observer(() => (
  <>
    <StreamChatSourceCard />
    <ChatCommandsCard />
  </>
));
