import {
  bool,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/**
 * Presentation only. The channel to read and the sign-in state live in
 * appSettings instead: a chat source is a property of the account, not of a
 * layout, and re-entering the channel per layout would be absurd.
 */
export const STREAM_CHAT_SETTINGS = defineSettings('streamChat', {
  /** Nick and text share one wrapped line, the way Twitch itself renders it. */
  compactRows: bool(true),
  /**
   * Scrollback depth, not the number of rows on screen — how many messages fit
   * is measured from the rendered list, since a message is as tall as its text.
   */
  maxMessages: num(100, { min: 3, max: 200 }),
  /** Seconds before a message fades out. 0 keeps everything. */
  messageLifetimeSeconds: num(0, { min: 0, max: 600 }),
  showPlatformGlyph: bool(true),
  showBadges: bool(true),
  /**
   * Draw the platform's own badge artwork instead of text plates. Twitch
   * artwork resolves only while signed in (the anonymous badge host was
   * retired), so this silently falls back to plates otherwise. Plates by
   * default: badge artwork is colourful and busy, and this widget sits over a
   * race track where a glanceable MOD reads faster.
   */
  badgeImages: bool(false),
  /** Header line with the connection state and the room restriction. */
  showBanner: bool(true),
  showFooter: bool(true),
  showActivity: bool(true),
  /** Subscriptions, raids and Super Chat rows. */
  showEvents: bool(true),
  /**
   * Follow rows, which arrive only over EventSub and so only while signed in
   * to the channel being watched. Separate from `showEvents` because a small
   * channel collects follows far faster than subscriptions, and a feed worth
   * keeping for subs can be worth silencing for follows.
   */
  showFollows: bool(true),
  /**
   * The "waiting for messages" line while the feed is idle. Off leaves the
   * widget blank until something arrives, which is what an overlay that sits
   * on camera the whole session wants.
   */
  showPlaceholder: bool(true),
});

export type StreamChatWidgetSettings = SettingsOf<
  typeof STREAM_CHAT_SETTINGS.shape
>;
