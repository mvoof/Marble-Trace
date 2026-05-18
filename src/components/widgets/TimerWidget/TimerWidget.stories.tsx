import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type {
  CarIdxFrame,
  LapTimingFrame,
  SessionFrame,
  SessionInfo,
  SessionState as BindingSessionState,
} from '../../../types/bindings';
import { TimerWidget } from './TimerWidget';
import { widgetDecorator } from '../../../stories/widgetDecorator';

const SESSION_FLAG_CHECKERED = 0x0001;

interface StoryArgs {
  sessionType: string;
  sessionLaps: string;
  remainSec: number | null;
  elapsedSec: number;
  simTimeOfDay: number | null;
  checkered: boolean;
  sessionState: BindingSessionState;
  currentLap: number;
  position: number;
  totalDrivers: number;
  showFlag: boolean;
  showLaps: boolean;
  showPosition: boolean;
  showWallClock: boolean;
  showSimTime: boolean;
  showPcDate: boolean;
  showSimDate: boolean;
}

const PLAYER_CAR_IDX = 0;

const buildCarIdxLap = (lap: number): number[] => {
  const arr: number[] = new Array(64).fill(0) as number[];
  arr[PLAYER_CAR_IDX] = lap;
  return arr;
};

const applyArgs = (args: StoryArgs) => {
  runInAction(() => {
    telemetryStore.updateSessionInfo({
      DriverInfo: {
        DriverCarIdx: PLAYER_CAR_IDX,
        Drivers: new Array(args.totalDrivers).fill(null).map((_, idx) => ({
          CarIdx: idx,
        })),
      },
      SessionInfo: {
        Sessions: [
          {
            SessionNum: 0,
            SessionType: args.sessionType,
            SessionLaps: args.sessionLaps,
          },
        ],
      },
      WeekendInfo: {
        WeekendOptions: { Date: '2026 May 18' },
      },
    } as unknown as SessionInfo);

    telemetryStore.updateSession({
      session_num: 0,
      session_time_remain: args.remainSec,
      session_time: args.elapsedSec,
      session_time_of_day: args.simTimeOfDay,
      session_flags: args.checkered ? SESSION_FLAG_CHECKERED : 0,
      session_state: args.sessionState,
    } as SessionFrame);

    telemetryStore.updateCarIdx({
      car_idx_lap: buildCarIdxLap(args.currentLap),
    } as unknown as CarIdxFrame);

    telemetryStore.updateLapTiming({
      player_car_position: args.position,
    } as LapTimingFrame);

    widgetSettingsStore.updateUserSettings('timer', {
      showFlag: args.showFlag,
      showLaps: args.showLaps,
      showPosition: args.showPosition,
      showWallClock: args.showWallClock,
      showSimTime: args.showSimTime,
      showPcDate: args.showPcDate,
      showSimDate: args.showSimDate,
    });
  });
};

const StoryHost = (args: StoryArgs) => {
  useEffect(() => {
    applyArgs(args);
  }, [args]);
  return <TimerWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/TimerWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ display: 'inline-block', minWidth: 180 })],
  args: {
    sessionType: 'RACE',
    sessionLaps: '30',
    remainSec: 42 * 60 + 18,
    elapsedSec: 0,
    simTimeOfDay: null,
    checkered: false,
    sessionState: 'Racing',
    currentLap: 12,
    position: 5,
    totalDrivers: 24,
    showFlag: true,
    showLaps: true,
    showPosition: true,
    showWallClock: false,
    showSimTime: false,
    showPcDate: false,
    showSimDate: false,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const RaceGreen: Story = {};

export const Practice: Story = {
  args: {
    sessionType: 'PRACTICE',
    sessionLaps: 'unlimited',
    remainSec: 18 * 60 + 42,
    showLaps: false,
    showPosition: false,
  },
};

export const FinalMinutes: Story = {
  args: { remainSec: 4 * 60 + 55 },
};

export const Checkered: Story = {
  args: { remainSec: 0, checkered: true, currentLap: 30 },
};

export const SessionEnded: Story = {
  args: { sessionState: 'Checkered' },
};

export const WithClocks: Story = {
  args: {
    showWallClock: true,
    showSimTime: true,
    simTimeOfDay: 16 * 3600,
  },
};

export const MinimalView: Story = {
  args: { showFlag: false, showLaps: false, showPosition: false },
};
