import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import type { ChatMessage, ChatPlatform } from '@/types/bindings';
import type { StreamChatWidgetSettings } from '@/types/widget-settings';

const makeMessage = (
  id: string,
  authorName: string,
  body: string,
  platform: ChatPlatform = 'twitch',
  ageMs = 0
): ChatMessage => ({
  platform,
  id,
  authorName,
  authorColor: '#ffffff',
  badges: [],
  fragments: [{ kind: 'text', text: body }],
  timestampMs: Date.now() - ageMs,
  highlight: null,
});

describe('StreamChatWidgetStore', () => {
  let rootStore: RootStore;

  const setSettings = (partial: Partial<StreamChatWidgetSettings>) => {
    runInAction(() => {
      const settings =
        rootStore.widgetSettings.getSettings<StreamChatWidgetSettings>(
          'stream-chat'
        );

      rootStore.widgetSettings.updateUserSettings('stream-chat', {
        ...settings,
        ...partial,
      });
    });
  };

  const seed = (messages: ChatMessage[]) => {
    runInAction(() => {
      rootStore.chat.messages = messages;
    });
  };

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
  });

  it('hides bot commands when the filter is on', () => {
    runInAction(() => rootStore.appSettings.setStreamChatHideCommands(true));
    seed([
      makeMessage('1', 'viewer', '!drops'),
      makeMessage('2', 'viewer', 'hello'),
    ]);

    expect(rootStore.streamChatWidget.visibleMessages).toHaveLength(1);
    expect(rootStore.streamChatWidget.visibleMessages[0].id).toBe('2');
  });

  it('keeps commands when the filter is off', () => {
    runInAction(() => rootStore.appSettings.setStreamChatHideCommands(false));
    seed([makeMessage('1', 'viewer', '!drops')]);

    expect(rootStore.streamChatWidget.visibleMessages).toHaveLength(1);
  });

  it('drops messages from ignored bots regardless of casing', () => {
    runInAction(() =>
      rootStore.appSettings.setStreamChatIgnoredBots('Nightbot')
    );
    seed([
      makeMessage('1', 'nightbot', 'stay hydrated'),
      makeMessage('2', 'human', 'nice lap'),
    ]);

    expect(rootStore.streamChatWidget.visibleMessages.map((m) => m.id)).toEqual(
      ['2']
    );
  });

  it('scrolls the window back through the history and clamps at both ends', () => {
    setSettings({ maxMessages: 2 });
    seed([
      makeMessage('1', 'a', 'one'),
      makeMessage('2', 'b', 'two'),
      makeMessage('3', 'c', 'three'),
      makeMessage('4', 'd', 'four'),
    ]);

    runInAction(() => rootStore.streamChatWidget.scrollByRows(1));
    expect(rootStore.streamChatWidget.visibleMessages.map((m) => m.id)).toEqual(
      ['2', '3']
    );

    runInAction(() => rootStore.streamChatWidget.scrollByRows(10));
    expect(rootStore.streamChatWidget.visibleMessages.map((m) => m.id)).toEqual(
      ['1', '2']
    );

    runInAction(() => rootStore.streamChatWidget.scrollByRows(-10));
    expect(rootStore.streamChatWidget.isScrolled).toBe(false);
    expect(rootStore.streamChatWidget.visibleMessages.map((m) => m.id)).toEqual(
      ['3', '4']
    );
  });

  it('caps the feed at maxMessages keeping the newest', () => {
    setSettings({ maxMessages: 2 });
    seed([
      makeMessage('1', 'a', 'one'),
      makeMessage('2', 'b', 'two'),
      makeMessage('3', 'c', 'three'),
    ]);

    expect(rootStore.streamChatWidget.visibleMessages.map((m) => m.id)).toEqual(
      ['2', '3']
    );
  });

  it('expires messages older than the configured lifetime', () => {
    setSettings({ messageLifetimeSeconds: 10 });
    seed([
      makeMessage('old', 'a', 'stale', 'twitch', 30_000),
      makeMessage('new', 'b', 'fresh'),
    ]);

    expect(rootStore.streamChatWidget.visibleMessages.map((m) => m.id)).toEqual(
      ['new']
    );
  });

  it('keeps everything when the lifetime is zero', () => {
    setSettings({ messageLifetimeSeconds: 0 });
    seed([makeMessage('old', 'a', 'stale', 'twitch', 600_000)]);

    expect(rootStore.streamChatWidget.visibleMessages).toHaveLength(1);
  });

  it('sums viewers only across platforms that report a number', () => {
    runInAction(() => {
      rootStore.chat.updatePresence({
        platform: 'twitch',
        status: 'live',
        viewers: null,
        uptimeSeconds: null,
        roomMode: null,
        retry: null,
        detail: null,
      });
      rootStore.chat.updatePresence({
        platform: 'youtube',
        status: 'live',
        viewers: 312,
        uptimeSeconds: null,
        roomMode: null,
        retry: null,
        detail: null,
      });
    });

    expect(rootStore.streamChatWidget.totalViewers).toBe(312);
  });

  it('counts only messages inside the activity window', () => {
    seed([
      makeMessage('1', 'a', 'recent'),
      makeMessage('2', 'b', 'ancient', 'twitch', 120_000),
    ]);

    expect(rootStore.streamChatWidget.messagesPerMinute).toBe(1);
  });
});

describe('ChatStore', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
  });

  it('merges presence so a status update keeps the last viewer count', () => {
    runInAction(() => {
      rootStore.chat.updatePresence({
        platform: 'twitch',
        status: 'live',
        viewers: 1248,
        uptimeSeconds: null,
        roomMode: null,
        retry: null,
        detail: null,
      });
      rootStore.chat.updatePresence({
        platform: 'twitch',
        status: 'reconnecting',
        viewers: null,
        uptimeSeconds: null,
        roomMode: null,
        retry: 2,
        detail: null,
      });
    });

    const presence = rootStore.chat.presence.get('twitch');

    expect(presence?.status).toBe('reconnecting');
    expect(presence?.viewers).toBe(1248);
  });

  it('removes a single deleted message by id', () => {
    runInAction(() => {
      rootStore.chat.messages = [
        makeMessage('keep', 'a', 'one'),
        makeMessage('drop', 'b', 'two'),
      ];
      rootStore.chat.applyDeletion({
        platform: 'twitch',
        messageId: 'drop',
        authorName: null,
      });
    });

    expect(rootStore.chat.messages.map((m) => m.id)).toEqual(['keep']);
  });

  it('clears a banned author across casing differences', () => {
    runInAction(() => {
      rootStore.chat.messages = [
        makeMessage('1', 'SlowLap', 'one'),
        makeMessage('2', 'SlowLap', 'two'),
        makeMessage('3', 'other', 'three'),
      ];
      rootStore.chat.applyDeletion({
        platform: 'twitch',
        messageId: null,
        authorName: 'slowlap',
      });
    });

    expect(rootStore.chat.messages.map((m) => m.id)).toEqual(['3']);
  });

  it('leaves other platforms untouched when moderating one', () => {
    runInAction(() => {
      rootStore.chat.messages = [
        makeMessage('yt', 'same', 'one', 'youtube'),
        makeMessage('tw', 'same', 'two', 'twitch'),
      ];
      rootStore.chat.applyDeletion({
        platform: 'twitch',
        messageId: null,
        authorName: 'same',
      });
    });

    expect(rootStore.chat.messages.map((m) => m.id)).toEqual(['yt']);
  });
});
