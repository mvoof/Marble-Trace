import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const STREAM_CHAT_MANIFEST: WidgetManifest = {
  id: 'stream-chat',
  label: 'Stream Chat',
  description: 'Twitch and YouTube live chat in one feed.',
  // No requiredCapabilities on purpose: chat is not sim data and stays
  // useful while no sim is running at all.
  designWidth: 380,
  designHeight: 340,
  userSettings: {
    enabled: false,
    x: 50,
    y: 600,
    currentWidth: 380,
    currentHeight: 340,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    compactRows: true,
    maxMessages: 100,
    messageLifetimeSeconds: 0,
    showPlatformGlyph: true,
    showBadges: true,
    // Text plates by default: badge artwork is colourful and busy, and this
    // widget sits over a race track where a glanceable MOD reads faster.
    badgeImages: false,
    showBanner: true,
    showFooter: true,
    showActivity: true,
    showEvents: true,
  },
};
