import type { CSSProperties } from 'react';
import type { WidgetUserSettings } from '@/types/widget-settings';

// Widgets whose plate is not a plain rounded rectangle need the frame that
// hosts them (overlay container, widget preview, layout editor) to clip with
// a matching border-radius. Shared here so every frame renders the same shape.
export const widgetFrameBorderRadius = (
  widgetId: string,
  userSettings: Record<string, unknown>
): string | undefined => {
  if (widgetId === 'input-trace' && userSettings.showSteering === true) {
    return `calc(12px * var(--wfs, 1)) 9999px 9999px calc(12px * var(--wfs, 1))`;
  }

  // The proximity radar is a scope: its plate is the circle the user colors
  // through the ordinary background and border settings.
  if (widgetId === 'proximity-radar') {
    return '50%';
  }

  if (widgetId === 'race-dash') {
    return `calc(52px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(52px * var(--wfs, 1))`;
  }

  return undefined;
};

export const DEFAULT_WIDGET_BACKGROUND = 'rgba(21, 22, 26, 0.8)';
export const DEFAULT_WIDGET_BORDER = 'rgba(255, 255, 255, 0.1)';

interface WidgetFrameStyleInput {
  widgetId: string;
  userSettings: Partial<WidgetUserSettings>;
  widgetScale: number;
  transparentContainer?: boolean;
  autoHeight?: boolean;
  /** The overlay keeps a hidden widget mounted but strips its plate away. */
  hidden?: boolean;
}

/**
 * The plate every frame that hosts a widget paints — overlay container, layout
 * editor, settings preview and remote screen. One place decides how the user's
 * appearance settings become CSS, so a new one (the background opacity, say)
 * reaches all four at once.
 */
export const widgetFrameStyle = ({
  widgetId,
  userSettings,
  widgetScale,
  transparentContainer = false,
  autoHeight = false,
  hidden = false,
}: WidgetFrameStyleInput): CSSProperties => {
  const backgroundColor =
    userSettings.backgroundColor ?? DEFAULT_WIDGET_BACKGROUND;

  const borderColor = userSettings.borderColor ?? DEFAULT_WIDGET_BORDER;
  const isPlateless = transparentContainer || hidden;

  return {
    ...(autoHeight ? { height: 'auto' } : undefined),
    background: isPlateless ? 'transparent' : backgroundColor,
    borderColor: isPlateless ? 'transparent' : borderColor,
    borderWidth: transparentContainer ? 0 : undefined,
    borderRadius: widgetFrameBorderRadius(
      widgetId,
      userSettings as unknown as Record<string, unknown>
    ),
    ['--wfs']: widgetScale,
    ['--font-scale']: userSettings.fontScale ?? 1,
    ['--widget-bg']: backgroundColor,
    ['--widget-border']: borderColor,
  } as CSSProperties;
};
