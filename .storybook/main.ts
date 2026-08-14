import type { StorybookConfig } from '@storybook/react-vite';
import svgr from 'vite-plugin-svgr';
import { createStorybookAliases } from '../vite.aliases.ts';

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
        additionalData: `
          @use "@/styles/functions" as *;
          @use "@/styles/variables" as *;
          @use "@/styles/widget-tokens" as *;
          @use "@/styles/sys-tokens" as *;
          @use "@/styles/opacity" as *;
        `,
      },
    };

    return config;
  },
};

export default config;
