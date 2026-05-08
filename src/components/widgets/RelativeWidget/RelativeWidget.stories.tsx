import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelativeWidget } from './RelativeWidget';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshotRaw from '../../../../test-data/iracing-1776008424511.json';

const snapshot = snapshotRaw as unknown as TelemetrySnapshot;
const DRIVER_ENTRIES = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo?.DriverInfo ?? null
);

const DEFAULT_SETTINGS = {
  showIRatingBadge: false,
  showClassBadge: false,
  showPitIndicator: true,
  showTrendIcon: true,
  abbreviateNames: false,
};

const meta: Meta<typeof RelativeWidget> = {
  title: 'Widgets/RelativeWidget',
  component: RelativeWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 420,
          height: 400,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    entries: DRIVER_ENTRIES,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof RelativeWidget>;

export const Default: Story = {};

export const MinimalView: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showIRatingBadge: false,
      showClassBadge: false,
      showPitIndicator: false,
      showTrendIcon: false,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, abbreviateNames: true },
  },
};

export const WithPitIndicator: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showPitIndicator: true },
  },
};
