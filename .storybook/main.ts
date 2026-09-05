import type { StorybookConfig } from '@storybook/react-vite';
import svgr from 'vite-plugin-svgr';
import {
  createStorybookAliases,
  SCSS_ADDITIONAL_DATA,
} from '../vite.aliases.ts';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  viteFinal: (config) => {
    config.plugins = [
      ...(config.plugins ?? []),
      svgr({
        svgrOptions: {
          icon: true,
        },
      }),
    ];

    config.resolve = config.resolve ?? {};
    config.resolve.alias = createStorybookAliases();

    config.css = config.css ?? {};
    config.css.preprocessorOptions = {
      scss: {
        additionalData: SCSS_ADDITIONAL_DATA,
      },
    };

    return config;
  },
};

export default config;
