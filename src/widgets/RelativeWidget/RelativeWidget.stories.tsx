import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelativeList } from './RelativeList/RelativeList';
import { driverEntries } from '../../storybook/test-data';
import { widgetDecorator } from '../../storybook/widgetDecorator';

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const DRIVER_ENTRIES = driverEntries.map((e, i) => ({
  ...e,
  carClassShortName: CLASS_LABELS[i % CLASS_LABELS.length],
}));

const DEFAULT_SETTINGS = {
  showIRatingBadge: false,
  showClassBadge: false,
  showPitIndicator: true,
  showTrendIcon: true,
  abbreviateNames: false,
};

const meta: Meta<typeof RelativeList> = {
  title: 'Widgets/RelativeWidget',
  component: RelativeList,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 420, height: 400 })],
  args: {
    entries: DRIVER_ENTRIES,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof RelativeList>;

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

export const WithClassBadge: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showClassBadge: true },
  },
};
