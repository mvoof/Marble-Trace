import type { Decorator } from '@storybook/react-vite';

interface WidgetDecoratorOptions {
  width?: number | string;
  height?: number | string;
  background?: string;
  display?: string;
  minWidth?: number;
}

const DEFAULT_BG = 'radial-gradient(circle, #252525 0%, #14141b 100%)';
const WIDGET_BORDER = '2px solid rgba(255, 255, 255, 0.1)';
const WIDGET_BORDER_RADIUS = 6;

export const widgetDecorator = (
  options: WidgetDecoratorOptions = {}
): Decorator => {
  const { width, height, background = DEFAULT_BG, display, minWidth } = options;

  const WidgetDecoratorWrapper = (Story: Parameters<Decorator>[0]) => (
    <div
      style={{
        width,
        height,
        background,
        borderRadius: WIDGET_BORDER_RADIUS,
        border: WIDGET_BORDER,
        overflow: 'hidden',
        display,
        minWidth,
      }}
    >
      <Story />
    </div>
  );

  return WidgetDecoratorWrapper;
};
