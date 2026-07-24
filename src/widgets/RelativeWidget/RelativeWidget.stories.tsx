import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackSurface } from '@/types';
import type { CarIdxFrame, DriverEntry, RelativeFrame } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import { driverEntries, snapshot } from '@/storybook/test-data';
import { RelativeWidget } from './RelativeWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const BASE_ENTRIES: DriverEntry[] = driverEntries.map((entry, idx) => ({
  ...entry,
  carClassShortName: CLASS_LABELS[idx % CLASS_LABELS.length],
  onPitRoad: false,
  trackSurface: TrackSurface.OnTrack,
  pitState: 'none' as const,
  rawFlags: 0,
}));

const PLAYER_CAR_IDX =
  BASE_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;
const PLAYER_IDX = BASE_ENTRIES.findIndex((entry) => entry.isPlayer);

const BLUE_FLAG = 0x00000020;
const MEATBALL_FLAG = 0x00100000;
const PENALTY_FLAG = 0x00010000;

const withOverrides = (
  overrides: Record<number, Partial<DriverEntry>>
): DriverEntry[] =>
  BASE_ENTRIES.map((entry, idx) => {
    const offset = idx - PLAYER_IDX;
    const override = overrides[offset];

    return override ? { ...entry, ...override } : entry;
  });

const PIT_ENTRIES = withOverrides({
  [-2]: { onPitRoad: true, pitState: 'in' as const },
  [-1]: { trackSurface: TrackSurface.InPitStall, pitState: 'stall' as const },
  [2]: { onPitRoad: true, pitState: 'exit' as const },
});

const FLAG_ENTRIES = withOverrides({
  [-3]: { rawFlags: BLUE_FLAG },
  [-1]: { rawFlags: MEATBALL_FLAG },
  [1]: { rawFlags: PENALTY_FLAG },
});

const DEFAULT_SETTINGS: RelativeWidgetSettings = {
  showLicBadge: true,
  showIRating: true,
  showPitIndicator: true,
  abbreviateNames: false,
  showDriverFlags: true,
};

const PACE_CAR_IDX = 61;
const SECOND_PACE_CAR_IDX = 62;

const seedPaceCar = (
  updateSessionInfo: (info: NonNullable<typeof snapshot.sessionInfo>) => void,
  updateCarIdx: (frame: CarIdxFrame) => void,
  multiclass = false
) => {
  const player = BASE_ENTRIES[PLAYER_IDX];
  const otherClassEntry = BASE_ENTRIES.find(
    (entry) => entry.carClassId !== player.carClassId
  );

  const lapDist = new Array(SECOND_PACE_CAR_IDX + 1).fill(-1);
  const estTime = new Array(SECOND_PACE_CAR_IDX + 1).fill(0);
  lapDist[PACE_CAR_IDX] = player.lapDistPct + 0.05;
  estTime[PACE_CAR_IDX] = player.estTime + 4;

  if (snapshot.sessionInfo) {
    const template = snapshot.sessionInfo.cars[0];
    const paceCars = [
      {
        ...template,
        carIdx: PACE_CAR_IDX,
        userName: 'Pace Car',
        carNumber: '0',
        isPaceCar: true,
        carClassId: player.carClassId,
        carClassEstLapTime: player.classEstLapTime,
      },
    ];

    if (multiclass && otherClassEntry) {
      paceCars.push({
        ...template,
        carIdx: SECOND_PACE_CAR_IDX,
        userName: 'Pace Car',
        carNumber: '00',
        isPaceCar: true,
        carClassId: otherClassEntry.carClassId,
        carClassEstLapTime: otherClassEntry.classEstLapTime,
      });

      lapDist[SECOND_PACE_CAR_IDX] = otherClassEntry.lapDistPct - 0.04;
      estTime[SECOND_PACE_CAR_IDX] = otherClassEntry.estTime - 3;
    }

    updateSessionInfo({
      ...snapshot.sessionInfo,
      cars: [...snapshot.sessionInfo.cars, ...paceCars],
    });
  }

  updateCarIdx({
    car_idx_lap_dist_pct: lapDist,
    car_idx_est_time: estTime,
  } as CarIdxFrame);
};

interface StoryArgs {
  settings: RelativeWidgetSettings;
  entries: DriverEntry[];
  paceCar?: boolean;
  multiclassPaceCar?: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RelativeWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
    seed: (store, args) => {
      store.backendComputed.updateRelative({
        entries: args.entries,
        playerCarIdx: PLAYER_CAR_IDX,
      } as RelativeFrame);
      store.widgetSettings.updateUserSettings('relative', args.settings);

      if (args.paceCar || args.multiclassPaceCar) {
        seedPaceCar(
          (info) => store.session.updateSessionInfo(info),
          (frame) => store.cars.updateCarIdx(frame),
          args.multiclassPaceCar
        );
      }
    },
    args: { settings: DEFAULT_SETTINGS, entries: BASE_ENTRIES },
    argTypes: {
      entries: { table: { disable: true } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const MinimalView: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showLicBadge: false,
      showIRating: false,
      showPitIndicator: false,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, abbreviateNames: true },
  },
};

export const WithPitBadges: Story = {
  args: { entries: PIT_ENTRIES },
};

export const WithDriverFlags: Story = {
  args: { entries: FLAG_ENTRIES },
};

export const WithSafetyCarRow: Story = {
  args: { paceCar: true },
};

export const WithMulticlassSafetyCarRows: Story = {
  args: { multiclassPaceCar: true },
};
