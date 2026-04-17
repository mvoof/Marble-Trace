import type { Preview } from '@storybook/react';
import '../src/styles/index.scss';
import { widgetSettingsStore } from '../src/store/widget-settings.store';

// Pre-load widget settings so stores have DEFAULT_WIDGETS populated before stories render
widgetSettingsStore.loadSettings();

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
        { name: 'transparent', value: 'transparent' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
