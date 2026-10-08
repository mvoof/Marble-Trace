import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { STREAM_CHAT_SETTINGS } from './settings-schema';

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
    ...STREAM_CHAT_SETTINGS.defaults,
  },
  settingsSchema: STREAM_CHAT_SETTINGS,
};
