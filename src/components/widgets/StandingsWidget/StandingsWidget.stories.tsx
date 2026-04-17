import type { Meta, StoryObj } from '@storybook/react-vite';

import { StandingsWidget } from './StandingsWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeStandingsEntries, computeClassSof } from './standings-utils';
import { computeProjectedIrDelta } from '../../../utils/iracing-irating';
import type { StandingsWidgetSettings } from '../../../store/widget-settings.store';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 400;

const realSnapshot = snapshot as TelemetrySnapshot;

const DEFAULT_SETTINGS: StandingsWidgetSettings = {
  filterMode: 'all',
  groupByClass: true,
  showPosChange: true,
  showColumnHeaders: true,
  showSessionHeader: true,
  showWeather: true,
  showSOF: true,
  showTotalDrivers: true,
  showBrand: true,
  showTire: true,
  showIrChange: false,
  showPitStops: true,
};

interface StandingsStoryArgs extends StandingsWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const StandingsWidgetStory = ({
  snapshot: snap,
  ...settings
}: StandingsStoryArgs) => {
  const driverEntries = computeStandingsEntries(
    snap.carIdx,
    snap.sessionInfo?.DriverInfo ?? null,
    new Map()
  );
  const overallSof = computeClassSof(driverEntries);
  const irDeltaMap = settings.showIrChange
    ? computeProjectedIrDelta(
        driverEntries.map((d) => ({
          carIdx: d.carIdx,
          classId: d.carClassId,
          classPosition: d.classPosition,
          iRating: d.iRating,
        }))
      )
    : new Map<number, number>();

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="radial-gradient(circle, #0a0a0f 0%, #050508 100%)"
        adaptive
      >
        <StandingsWidget
          driverEntries={driverEntries}
          settings={settings}
          irDeltaMap={irDeltaMap}
          playerPitStops={0}
          sessionInfo={snap.sessionInfo}
          weekendInfo={snap.sessionInfo?.WeekendInfo ?? null}
          overallSof={overallSof}
        />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<StandingsStoryArgs> = {
  title: 'Widgets/StandingsWidget',
  component: StandingsWidgetStory,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    filterMode: {
      control: 'radio',
      options: ['all'],
      table: { category: 'Widget Settings' },
    },
    groupByClass: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showPosChange: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showColumnHeaders: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showSessionHeader: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showWeather: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showSOF: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showTotalDrivers: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showBrand: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showTire: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showIrChange: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showPitStops: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<StandingsStoryArgs>;

export const Default: Story = {};

export const NoGrouping: Story = {
  args: {
    groupByClass: false,
  },
};

export const Minimal: Story = {
  args: {
    showSessionHeader: false,
    showWeather: false,
    showSOF: false,
    showTotalDrivers: false,
    showBrand: false,
    showTire: false,
    showPitStops: false,
    showIrChange: false,
    showPosChange: false,
  },
};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carDynamics: null,
      carIdx: null,
      carInputs: null,
      carStatus: null,
      environment: null,
      lapTiming: null,
      session: null,
      sessionInfo: null,
    },
  },
};
