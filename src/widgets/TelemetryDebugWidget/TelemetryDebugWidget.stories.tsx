import type { Meta, StoryObj } from '@storybook/react-vite';

import { TelemetryDebugWidget } from './TelemetryDebugWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

const meta: Meta<typeof TelemetryDebugWidget> = {
  title: 'Widgets/TelemetryDebugWidget',
  component: TelemetryDebugWidget,
  parameters: { layout: 'centered' },
  decorators: [withStore(seedFromSnapshot), widgetDecorator({ width: 420 })],
};

export default meta;
type Story = StoryObj<typeof TelemetryDebugWidget>;

export const Connected: Story = {
  decorators: [
    withStore((store) => {
      seedFromSnapshot(store);
      store.telemetryConnection.status = 'connected';
    }),
    widgetDecorator({ width: 420 }),
  ],
};

export const Disconnected: Story = {
  decorators: [
    withStore((store) => {
      store.telemetryConnection.status = 'disconnected';
    }),
    widgetDecorator({ width: 420 }),
  ],
};

export const Error: Story = {
  decorators: [
    withStore((store) => {
      store.telemetryConnection.status = 'error';
    }),
    widgetDecorator({ width: 420 }),
  ],
};
