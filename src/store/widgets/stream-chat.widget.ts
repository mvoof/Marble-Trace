import { makeAutoObservable, runInAction } from 'mobx';

import type { ChatMessage, ChatPresence } from '@/types/bindings';
import type { StreamChatWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';

const WIDGET_ID = 'stream-chat';

// Sliding window for the messages-per-minute readout.
const RATE_WINDOW_MS = 60_000;
// How often the clock-driven getters (expiry, rate) are re-evaluated. One
// second is enough for both and keeps the overlay off a per-frame timer.
const TICK_MS = 1_000;

export class StreamChatWidgetStore {
  /** Advanced by a timer so time-based getters re-run without telemetry. */
  private tick = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable<StreamChatWidgetStore, 'tickTimer'>(
      this,
      { tickTimer: false },
      { autoBind: true }
    );
  }

  init() {
    if (this.tickTimer !== null) {
      return;
    }

    this.tickTimer = setInterval(() => {
      runInAction(() => {
        this.tick += 1;
      });
    }, TICK_MS);
  }

  dispose() {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private get settings(): StreamChatWidgetSettings {
    return this.root.widgetSettings.getSettings<StreamChatWidgetSettings>(
      WIDGET_ID
    );
  }

  /**
   * Newest last. Applies the per-layout row cap and, when enabled, drops
   * messages older than the configured lifetime so a quiet chat fades out
   * instead of freezing on stale rows.
   */
  /** Bot names are source-level policy, so they live in appSettings. */
  private get ignoredBots(): string[] {
    return this.root.appSettings.appSettings.streamChatIgnoredBots
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0);
  }

  private isFiltered(message: ChatMessage): boolean {
    const { streamChatHideCommands } = this.root.appSettings.appSettings;

    if (this.ignoredBots.includes(message.authorName.toLowerCase())) {
      return true;
    }

    if (!streamChatHideCommands) {
      return false;
    }

    const firstText = message.fragments.find(
      (fragment) => fragment.kind === 'text'
    );

    return firstText?.text.trimStart().startsWith('!') === true;
  }

  get visibleMessages(): ChatMessage[] {
    const { maxMessages, messageLifetimeSeconds, showEvents } = this.settings;

    // Reading the tick makes this getter recompute on the timer.
    void this.tick;

    let messages = this.root.chat.messages.filter(
      (message) => !this.isFiltered(message)
    );

    if (!showEvents) {
      messages = messages.filter((message) => message.highlight === null);
    }

    if (messageLifetimeSeconds > 0) {
      const cutoff = Date.now() - messageLifetimeSeconds * 1000;
      messages = messages.filter((message) => message.timestampMs >= cutoff);
    }

    if (messages.length <= maxMessages) {
      return messages;
    }

    return messages.slice(messages.length - maxMessages);
  }

  get presenceList(): ChatPresence[] {
    return [...this.root.chat.presence.values()];
  }

  get totalViewers(): number | null {
    const counted = this.presenceList.filter(
      (presence) => presence.viewers !== null
    );

    if (counted.length === 0) {
      return null;
    }

    return counted.reduce(
      (total, presence) => total + (presence.viewers ?? 0),
      0
    );
  }

  /** Messages per minute across every platform, computed locally. */
  get messagesPerMinute(): number {
    void this.tick;

    const cutoff = Date.now() - RATE_WINDOW_MS;

    return this.root.chat.messages.filter(
      (message) => message.timestampMs >= cutoff
    ).length;
  }

  /** The single banner to show, if any — worst status across platforms wins. */
  get banner(): ChatPresence | null {
    const problem = this.presenceList.find(
      (presence) =>
        presence.status === 'error' ||
        presence.status === 'reconnecting' ||
        presence.status === 'connecting'
    );

    if (problem) {
      return problem;
    }

    return (
      this.presenceList.find((presence) => presence.roomMode !== null) ?? null
    );
  }

  get isIdle(): boolean {
    return this.visibleMessages.length === 0;
  }
}
