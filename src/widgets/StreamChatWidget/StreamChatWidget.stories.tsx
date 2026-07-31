import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ChatMessage, ChatPresence } from '@/types/bindings';
import { StreamChatWidget } from './StreamChatWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  messages: ChatMessage[];
  presence: ChatPresence[];
}

const text = (value: string) => ({ kind: 'text' as const, text: value });

const makeMessage = (
  id: string,
  platform: ChatMessage['platform'],
  authorName: string,
  authorColor: string,
  body: string,
  badges: ChatMessage['badges'] = []
): ChatMessage => ({
  platform,
  id,
  authorName,
  authorColor,
  badges,
  fragments: [text(body)],
  timestampMs: Date.now(),
  highlight: null,
});

const MESSAGES: ChatMessage[] = [
  makeMessage('1', 'twitch', 'kartoshka_dev', '#8b5cf6', 'ну и заезд конечно', [
    { kind: 'subscriber', label: 'SUB', url: null },
  ]),
  makeMessage('2', 'youtube', 'Alexey R.', '#3b82f6', 'какая машина?'),
  makeMessage(
    '3',
    'twitch',
    'apexhunter',
    '#10b981',
    'третий поворот опять рано тормозишь',
    [{ kind: 'moderator', label: 'MOD', url: null }]
  ),
  makeMessage('4', 'youtube', 'Марина', '#a855f7', 'обгон топ'),
  makeMessage('5', 'twitch', 'slowlap', '#f59e0b', 'резина уже никакая', [
    { kind: 'vip', label: 'VIP', url: null },
  ]),
  {
    ...makeMessage('6', 'twitch', 'apexhunter', '#10b981', ''),
    fragments: [],
    highlight: {
      kind: 'raid',
      text: 'apexhunter пришёл с рейдом · 142 зрителя',
      amount: null,
    },
  },
  {
    ...makeMessage('7', 'youtube', 'Sergey K', '#facc15', 'удачи в квале!'),
    highlight: { kind: 'paid', text: '', amount: '250 ₽' },
  },
  makeMessage('8', 'twitch', 'brakelate', '#ef4444', 'вот это сейв'),
];

const PRESENCE: ChatPresence[] = [
  {
    platform: 'twitch',
    status: 'live',
    viewers: 1248,
    uptimeSeconds: 5400,
    roomMode: null,
    retry: null,
    detail: null,
  },
  {
    platform: 'youtube',
    status: 'live',
    viewers: 312,
    uptimeSeconds: null,
    roomMode: null,
    retry: null,
    detail: null,
  },
];

const meta: Meta<StoryArgs> = {
  title: 'Widgets/StreamChatWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: StreamChatWidget,
    size: { width: 380, height: 340, background: '#12141a' },
    seed: (store, args) => {
      store.chat.messages = args.messages;
      store.chat.presence.clear();

      args.presence.forEach((entry) =>
        store.chat.presence.set(entry.platform, entry)
      );
    },
    args: { messages: MESSAGES, presence: PRESENCE },
  }),
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const TwitchOnly: Story = {
  args: {
    messages: MESSAGES.filter((message) => message.platform === 'twitch'),
    presence: PRESENCE.filter((entry) => entry.platform === 'twitch'),
  },
};

/** Anonymous mode: Twitch reports no viewer count, so the footer shows a dash. */
export const NoViewerCount: Story = {
  args: {
    presence: PRESENCE.map((entry) =>
      entry.platform === 'twitch' ? { ...entry, viewers: null } : entry
    ),
  },
};

export const Empty: Story = {
  args: { messages: [] },
};

export const Reconnecting: Story = {
  args: {
    presence: [
      { ...PRESENCE[0], status: 'reconnecting', retry: 3 },
      PRESENCE[1],
    ],
  },
};

export const SubscriberOnlyMode: Story = {
  args: {
    presence: [{ ...PRESENCE[0], roomMode: 'subs only' }, PRESENCE[1]],
  },
};
