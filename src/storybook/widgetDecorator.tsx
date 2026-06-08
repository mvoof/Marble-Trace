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
}

const DEFAULT_BG = 'rgba(21, 22, 26, 0.8)';
const WIDGET_BORDER = '2px solid rgba(255, 255, 255, 0.1)';
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
  } = options;

  const WidgetDecoratorWrapper = (Story: Parameters<Decorator>[0]) => (
    <div
      style={
        {
          width,
          height,
          background,
          borderRadius,
          border: WIDGET_BORDER,
          overflow,
          display,
          minWidth,
          ['--widget-bg']: background,
        } as React.CSSProperties
      }
    >
      <Story />
    </div>
  );

  return WidgetDecoratorWrapper;
};
