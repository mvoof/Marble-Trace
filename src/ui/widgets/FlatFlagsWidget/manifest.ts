import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const FLAT_FLAGS_MANIFEST: WidgetManifest = {
  id: 'flat-flags',
  label: 'Flat Flags',
  description: 'Banner-style list of active track flags.',
  autoHeight: true,
  designWidth: 280,
  designHeight: 160,
  userSettings: {
    enabled: false,
    x: 760,
    y: 250,
    currentWidth: 280,
    currentHeight: 160,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    alwaysShow: true,
    holdDuration: 3,
  },
};
