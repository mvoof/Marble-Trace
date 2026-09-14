import type { Meta, StoryObj } from '@storybook/react-vite';

import type { RelativeWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import type { MockFieldRows } from '@store/preview/mocks/field';
import {
  MOCK_DRIVER_FLAG_ROWS,
  MOCK_PIT_ROWS,
  PACE_CAR_IDX,
  mockField,
  mockPaceCarEntry,
} from '@store/preview/mocks/field';
import { RelativeWidget } from './RelativeWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

/** The spacing the table is read at by default — a couple of seconds a place. */
const DEFAULT_GAP_S = 1.8;

const SECOND_PACE_CAR_IDX = PACE_CAR_IDX + 1;
/** How far up the road from the player each pace car sits, as a lap fraction. */
const PACE_CAR_LEAD_PCT = 0.05;
const SECOND_PACE_CAR_LEAD_PCT = -0.04;
const PACE_CAR_LEAD_S = 4;
const SECOND_PACE_CAR_LEAD_S = -3;

// A safety car is not a driver entry: it reaches the widget through the session
// roster and the per-car arrays, the way the sim reports it. Both halves are
// stated here so the row cannot appear in one and be missing from the other.
const seedPaceCars = (store: RootStore, multiclass: boolean) => {
  const sessionInfo = store.session.sessionInfo;
  const carIdx = store.cars.carIdx;
  const player = store.backendComputed.relativeEntries.find(
    (entry) => entry.isPlayer
  );

  if (!sessionInfo || !carIdx || !player) {
    return;
  }

  const otherClassEntry = store.backendComputed.relativeEntries.find(
    (entry) => entry.carClassId !== player.carClassId
  );
  const template = sessionInfo.cars[0];

  const paceCars = [
    mockPaceCarEntry(template, {
      carClassId: player.carClassId,
      carClassEstLapTime: player.classEstLapTime,
    }),
  ];

  const lapDist = [...carIdx.car_idx_lap_dist_pct];
  const estTime = [...carIdx.car_idx_est_time];

  lapDist[PACE_CAR_IDX] = player.lapDistPct + PACE_CAR_LEAD_PCT;
  estTime[PACE_CAR_IDX] = player.estTime + PACE_CAR_LEAD_S;

  if (multiclass && otherClassEntry) {
    paceCars.push(
      mockPaceCarEntry(template, {
        carIdx: SECOND_PACE_CAR_IDX,
        carNumber: '00',
        carClassId: otherClassEntry.carClassId,
        carClassEstLapTime: otherClassEntry.classEstLapTime,
      })
    );

    lapDist[SECOND_PACE_CAR_IDX] =
      otherClassEntry.lapDistPct + SECOND_PACE_CAR_LEAD_PCT;
    estTime[SECOND_PACE_CAR_IDX] =
      otherClassEntry.estTime + SECOND_PACE_CAR_LEAD_S;
  }

  store.session.updateSessionInfo({
    ...sessionInfo,
    cars: [...sessionInfo.cars, ...paceCars],
  });

  store.cars.updateCarIdx({
    ...carIdx,
    car_idx_lap_dist_pct: lapDist,
    car_idx_est_time: estTime,
  });
};

interface StoryArgs {
  /**
   * The settings this story differs from the shipped defaults in. Everything
   * left out keeps whatever the widget ships with.
   */
  settings?: Partial<RelativeWidgetSettings>;
  /** Seconds between one car and the next. */
  gapS?: number;
  /** Rows around the player to state something extra about. */
  rows?: MockFieldRows;
  /** A safety car of the player's own class, up the road. */
  paceCar?: boolean;
  /** A second safety car for the other class beside it. */
  multiclassPaceCar?: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RelativeWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
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
        store.liveWidgets.updateUserSettings('relative', args.settings);
      }

      if (args.paceCar || args.multiclassPaceCar) {
        seedPaceCars(store, args.multiclassPaceCar === true);
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

/** Sub-second between every car — the pack the relative is really read in. */
export const ClosePack: Story = {
  parameters: previewScenario('field-close-pack'),
};

export const MinimalView: Story = {
  args: {
    settings: {
      showLicBadge: false,
      showIRating: false,
      showPitIndicator: false,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: { settings: { abbreviateNames: true } },
};

export const WithPitBadges: Story = {
  args: { rows: MOCK_PIT_ROWS },
};

export const WithDriverFlags: Story = {
  args: { rows: MOCK_DRIVER_FLAG_ROWS },
};

export const WithSafetyCarRow: Story = {
  args: { paceCar: true },
};

export const WithMulticlassSafetyCarRows: Story = {
  args: { multiclassPaceCar: true },
};
