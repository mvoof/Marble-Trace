import {
  makeAutoObservable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';

import type { ChatMessage, ChatPresence } from '@/types/bindings';
import type { StreamChatWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';

const WIDGET_ID = 'stream-chat';

// Sliding window for the messages-per-minute readout.
const RATE_WINDOW_MS = 60_000;
// How often the clock-driven getters (expiry, rate) are re-evaluated. One
// second is enough for both and keeps the overlay off a per-frame timer.
const TICK_MS = 1_000;
// Floor on the scrollbar thumb so a long backlog still leaves it visible.
const MIN_THUMB_PERCENT = 12;

export class StreamChatWidgetStore {
  /** Advanced by a timer so time-based getters re-run without telemetry. */
  private tick = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * How many messages the view is lifted above the newest one. Zero means the
   * list is pinned to the bottom, which is the only state the overlay shows
   * outside interact mode.
   */
  scrollOffset = 0;

  private disposers: IReactionDisposer[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable<StreamChatWidgetStore, 'tickTimer' | 'disposers'>(
      this,
      { tickTimer: false, disposers: false },
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

    // The offset is counted from the newest message, so an arriving message
    // would slide the read position down a row. Growing with the buffer keeps
    // the same messages under the cursor while the user is scrolled back.
    this.disposers.push(
      reaction(
        () => this.filteredMessages.length,
        (length, previousLength) => {
          if (this.scrollOffset === 0 || length <= previousLength) {
            return;
          }

          this.scrollTo(this.scrollOffset + (length - previousLength));
        }
      ),
      // Leaving interact mode ends the reading session — snap back to live.
      reaction(
        () => this.root.appSettings.interactMode,
        (active) => {
          if (!active) {
            this.scrollTo(0);
          }
        }
      )
    );
  }

  dispose() {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.disposers.forEach((disposeReaction) => disposeReaction());
    this.disposers = [];
  }

  get maxScrollOffset(): number {
    return Math.max(
      0,
      this.filteredMessages.length - this.settings.maxMessages
    );
  }

  get isScrolled(): boolean {
    return this.scrollOffset > 0;
  }

  scrollTo(offset: number) {
    this.scrollOffset = Math.max(0, Math.min(offset, this.maxScrollOffset));
  }

  scrollByRows(rows: number) {
    this.scrollTo(this.scrollOffset + rows);
  }

  /**
   * Geometry of the scrollbar thumb in percent of the track, or null when the
   * history fits and there is nothing to indicate. The size floor keeps the
   * thumb grabbable-looking on a long backlog, so the offset is mapped onto the
   * leftover track rather than onto the raw message count.
   */
  get scrollThumb(): { heightPercent: number; topPercent: number } | null {
    const total = this.filteredMessages.length;
    const windowSize = Math.min(this.settings.maxMessages, total);

    if (this.maxScrollOffset === 0 || windowSize === 0) {
      return null;
    }

    const heightPercent = Math.max(
      MIN_THUMB_PERCENT,
      (windowSize / total) * 100
    );

    // Offset counts up from the newest message, so a zero offset parks the
    // thumb at the bottom of the track.
    const travelled = 1 - this.scrollOffset / this.maxScrollOffset;

    return {
      heightPercent,
      topPercent: (100 - heightPercent) * travelled,
    };
  }

  private get settings(): StreamChatWidgetSettings {
    return this.root.widgetSettings.getSettings<StreamChatWidgetSettings>(
      WIDGET_ID
    );
  }

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

  /** Everything that passes the filters, newest last and uncapped. */
  get filteredMessages(): ChatMessage[] {
    const { messageLifetimeSeconds, showEvents } = this.settings;

    // Reading the tick makes this getter recompute on the timer.
    void this.tick;

    let messages = this.root.chat.messages.filter(
      (message) => !this.isFiltered(message)
    );

    // Only the event rows themselves are dropped. A cheer or a first message is
    // still a message someone wrote, so hiding "subs and raids" must not take
    // them with it.
    if (!showEvents) {
      messages = messages.filter(
        (message) =>
          message.highlight === null ||
          (message.highlight.kind !== 'subscription' &&
            message.highlight.kind !== 'raid')
      );
    }

    if (messageLifetimeSeconds > 0) {
      const cutoff = Date.now() - messageLifetimeSeconds * 1000;
      messages = messages.filter((message) => message.timestampMs >= cutoff);
    }

    return messages;
  }

  /**
   * The drawn window: newest last, capped at the per-layout row count and
   * lifted by the scroll offset while the user reads back.
   */
  get visibleMessages(): ChatMessage[] {
    const messages = this.filteredMessages;
    const { maxMessages } = this.settings;

    if (messages.length <= maxMessages) {
      return messages;
    }

    // The scroll offset is clamped here too: the buffer can shrink between a
    // wheel event and this read (expiry, a ban wiping a user's messages).
    const offset = Math.min(this.scrollOffset, this.maxScrollOffset);
    const end = messages.length - offset;

    return messages.slice(end - maxMessages, end);
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
