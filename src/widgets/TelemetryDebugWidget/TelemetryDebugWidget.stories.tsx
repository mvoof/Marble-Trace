import type { Meta, StoryObj } from '@storybook/react-vite';

import type { TelemetryStatus } from '@/types';
import { TelemetryDebugWidget } from './TelemetryDebugWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  status: TelemetryStatus;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/TelemetryDebugWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: TelemetryDebugWidget,
    size: { width: 420 },
    seedSnapshot: true,
    seed: (store, args) => {
      store.telemetryConnection.status = args.status;
    },
    args: { status: 'connected' },
    argTypes: {
      status: {
        control: 'radio',
        options: ['connected', 'disconnected', 'error'],
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Connected: Story = {};

export const Disconnected: Story = {
  args: { status: 'disconnected' },
};

export const ConnectionError: Story = {
  args: { status: 'error' },
};
