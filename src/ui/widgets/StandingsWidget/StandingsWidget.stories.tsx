import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import type { MockFieldRows } from '@store/preview/mocks/field';
import {
  MOCK_DRIVER_FLAG_ROWS,
  MOCK_PIT_ROWS,
  mockField,
} from '@store/preview/mocks/field';
import { StandingsWidget } from './StandingsWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

/** The spacing the table is read at by default — a couple of seconds a place. */
const DEFAULT_GAP_S = 1.8;

interface StoryArgs {
  /**
   * The settings this story differs from the shipped defaults in. Everything
   * left out keeps whatever the widget ships with, so a story states only the
   * columns it is about.
   */
  settings?: Partial<StandingsWidgetSettings>;
  /** Which class the cycling view is showing. */
  activeClassIndex?: number;
  /** Seconds between one car and the next. */
  gapS?: number;
  /** Rows around the player to state something extra about. */
  rows?: MockFieldRows;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/StandingsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: StandingsWidget,
    size: { width: 796, height: 500 },
    seedSnapshot: true,
    seed: (store, args) => {
      const base = store.backendComputed.driverEntries;

      if (base) {
        const { driverEntries, relative } = mockField(base.entries, {
          gapS: args.gapS ?? DEFAULT_GAP_S,
          rows: args.rows,
        });

        store.backendComputed.updateDriverEntries(driverEntries);
        store.backendComputed.updateRelative(relative);
      }

      if (args.settings) {
        store.liveWidgets.updateUserSettings('standings', args.settings);
      }

      if (args.activeClassIndex !== undefined) {
        store.standingsWidget.activeClassIndex = args.activeClassIndex;
      }
    },
    argTypes: {
      rows: { table: { disable: true } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

/** Sub-second between every car — what the gap column carries a decimal for. */
export const ClosePack: Story = {
  parameters: previewScenario('field-close-pack'),
};

export const ClassCycling: Story = {
  args: { settings: { viewMode: 'cycling' }, activeClassIndex: 0 },
};

export const MinimalColumns: Story = {
  args: {
    settings: {
      showPosChange: false,
      showColumnHeaders: false,
      showSessionHeader: false,
    },
  },
};

export const WithAllColumns: Story = {
  args: {
    settings: {
      showBrand: true,
      showTire: true,
      showLicBadge: true,
      showIRating: true,
      showIrChange: true,
      showLapsCompleted: true,
      showPosChange: true,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: { settings: { abbreviateNames: true } },
};

export const NoHeaders: Story = {
  args: { settings: { showColumnHeaders: false, showSessionHeader: false } },
};

export const GroupedByClass: Story = {
  args: { settings: { viewMode: 'grouped', groupedRowsPerClass: 3 } },
};

export const SecondClass: Story = {
  args: { settings: { viewMode: 'cycling' }, activeClassIndex: 1 },
};

export const ThirdClass: Story = {
  args: { settings: { viewMode: 'cycling' }, activeClassIndex: 2 },
};

export const WithPitBadges: Story = {
  args: { rows: MOCK_PIT_ROWS },
};

export const WithDriverFlags: Story = {
  args: { rows: MOCK_DRIVER_FLAG_ROWS },
};
