import React from 'react';
import type { Decorator } from '@storybook/react-vite';

interface WidgetDecoratorOptions {
  width?: number | string;
  height?: number | string;
  background?: string;
  display?: string;
  minWidth?: number;
}

const DEFAULT_BG = 'radial-gradient(circle, #252525 0%, #14141b 100%)';
const DEFAULT_BG_COLOR = '#252525';
const WIDGET_BORDER = '2px solid rgba(255, 255, 255, 0.1)';
const WIDGET_BORDER_RADIUS = 6;

const extractBgColor = (bg: string): string => {
  const match = bg.match(/#[0-9a-fA-F]{3,6}/);
  return match ? match[0] : DEFAULT_BG_COLOR;
};

export const widgetDecorator = (
  options: WidgetDecoratorOptions = {}
): Decorator => {
  const { width, height, background = DEFAULT_BG, display, minWidth } = options;
  const bgColor = extractBgColor(background);

  const WidgetDecoratorWrapper = (Story: Parameters<Decorator>[0]) => (
    <div
      style={
        {
          width,
          height,
          background,
          borderRadius: WIDGET_BORDER_RADIUS,
          border: WIDGET_BORDER,
          overflow: 'hidden',
          display,
          minWidth,
          ['--widget-bg']: bgColor,
        } as React.CSSProperties
      }
    >
      <Story />
    </div>
  );

  return WidgetDecoratorWrapper;
};
