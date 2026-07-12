import React from 'react';
import type { Decorator } from '@storybook/react-vite';

interface WidgetDecoratorOptions {
  width?: number | string;
  height?: number | string;
  background?: string;
  display?: string;
  minWidth?: number;
  borderRadius?: string | number;
  overflow?: string;
  /**
   * Frame border override. transparentContainer widgets render border-free in
   * the real overlay (WidgetContainer zeroes the border), so their stories
   * pass 'none' to keep the inner content at the exact design size.
   */
  border?: string;
  /**
   * Value for --widget-bg, independent of the wrapper's own `background`.
   * Needed for transparentContainer widgets (e.g. RaceDash), which paint
   * their own plate from --widget-bg while the decorator wrapper itself
   * stays transparent to mimic the real overlay.
   */
  widgetBg?: string;
}

const DEFAULT_BG = 'rgba(21, 22, 26, 0.8)';
const WIDGET_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';
const WIDGET_BORDER = `2px solid ${WIDGET_BORDER_COLOR}`;
const WIDGET_BORDER_RADIUS = 6;

export const widgetDecorator = (
  options: WidgetDecoratorOptions = {}
): Decorator => {
  const {
    width,
    height,
    background = DEFAULT_BG,
    display,
    minWidth,
    borderRadius = WIDGET_BORDER_RADIUS,
    overflow = 'hidden',
    border = WIDGET_BORDER,
    widgetBg = background,
  } = options;

  const WidgetDecoratorWrapper = (Story: Parameters<Decorator>[0]) => (
    <div
      style={
        {
          width,
          height,
          background,
          borderRadius,
          border,
          overflow,
          display,
          minWidth,
          ['--widget-bg']: widgetBg,
          ['--widget-border']: WIDGET_BORDER_COLOR,
        } as React.CSSProperties
      }
    >
      <Story />
    </div>
  );

  return WidgetDecoratorWrapper;
};
