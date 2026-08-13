import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  CarIdxFrame,
  LapTimingFrame,
  SessionFrame,
  SessionSnapshot,
  SessionState as BindingSessionState,
  SessionType,
} from '@/types/bindings';
import { TimerWidget } from './TimerWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const SESSION_FLAG_CHECKERED = 0x0001;
const PLAYER_CAR_IDX = 0;

const buildCarIdxLap = (lap: number): number[] => {
  const arr: number[] = new Array(64).fill(0) as number[];
  arr[PLAYER_CAR_IDX] = lap;
  return arr;
};

interface StoryArgs {
  sessionType: SessionType;
  sessionTypeLabel: string;
  sessionLaps: string;
  remainSec: number | null;
  elapsedSec: number;
  simTimeOfDay: number | null;
  checkered: boolean;
  sessionState: BindingSessionState;
  currentLap: number;
  position: number;
  totalDrivers: number;
  showLaps: boolean;
  showPosition: boolean;
  showWallClock: boolean;
  showSimTime: boolean;
  showPcDate: boolean;
  showSimDate: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/TimerWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: TimerWidget,
    size: { width: 240, height: 120 },
    seedSnapshot: true,
    seed: (store, args) => {
      store.session.updateSessionInfo({
        playerCarIdx: PLAYER_CAR_IDX,
        cars: new Array(args.totalDrivers).fill(null).map((_, idx) => ({
          carIdx: idx,
        })),
        sessions: [
          {
            sessionType: args.sessionType,
            sessionTypeLabel: args.sessionTypeLabel,
            sessionLaps: String(args.sessionLaps),
            resultsPositions: [],
          },
        ],
        weekendDate: '2026 May 18',
      } as unknown as SessionSnapshot);

      store.session.updateSession({
        session_num: 0,
        session_time_remain: args.remainSec,
        session_time: args.elapsedSec,
        session_time_of_day: args.simTimeOfDay,
        session_flags: args.checkered ? SESSION_FLAG_CHECKERED : 0,
        session_state: args.sessionState,
      } as SessionFrame);

      store.cars.updateCarIdx({
        car_idx_lap: buildCarIdxLap(args.currentLap),
      } as unknown as CarIdxFrame);

      store.player.updateLapTiming({
        player_car_position: args.position,
      } as LapTimingFrame);

      store.widgetSettings.updateUserSettings('timer', {
        showLaps: args.showLaps,
        showPosition: args.showPosition,
        showWallClock: args.showWallClock,
        showSimTime: args.showSimTime,
        showPcDate: args.showPcDate,
        showSimDate: args.showSimDate,
      });
    },
    args: {
      sessionType: 'Race',
      sessionTypeLabel: 'Race',
      sessionLaps: '30',
      remainSec: 42 * 60 + 18,
      elapsedSec: 0,
      simTimeOfDay: null,
      checkered: false,
      sessionState: 'Racing',
      currentLap: 12,
      position: 5,
      totalDrivers: 24,
      showLaps: true,
      showPosition: true,
      showWallClock: false,
      showSimTime: false,
      showPcDate: false,
      showSimDate: false,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const RaceGreen: Story = {};

export const Practice: Story = {
  args: {
    sessionType: 'Practice',
    sessionTypeLabel: 'Practice',
    sessionLaps: 'unlimited',
    remainSec: 18 * 60 + 42,
    showLaps: false,
    showPosition: false,
  },
};

export const LoneQualify: Story = {
  args: {
    sessionType: 'Qualify',
    sessionTypeLabel: 'Lone Qualify',
    sessionLaps: 'unlimited',
    remainSec: 12 * 60,
    showLaps: false,
    showPosition: true,
    position: 3,
  },
};

export const OpenQualify: Story = {
  args: {
    sessionType: 'Qualify',
    sessionTypeLabel: 'Open Qualify',
    sessionLaps: 'unlimited',
    remainSec: 12 * 60,
    showLaps: false,
    showPosition: true,
    position: 3,
  },
};

export const FinalMinutes: Story = {
  args: { remainSec: 4 * 60 + 55 },
};

export const Checkered: Story = {
  args: { remainSec: 0, checkered: true, currentLap: 30 },
};

export const SessionEnded: Story = {
  args: { sessionState: 'CoolDown' },
};

export const WithClocks: Story = {
  args: { showWallClock: true, showSimTime: true, simTimeOfDay: 16 * 3600 },
};

export const MinimalView: Story = {
  args: { showLaps: false, showPosition: false },
};

export const TimedRace: Story = {
  args: { sessionLaps: 'unlimited', remainSec: 30 * 60, currentLap: 8 },
};

export const WithDates: Story = {
  args: {
    showWallClock: true,
    showSimTime: true,
    showPcDate: true,
    showSimDate: true,
    simTimeOfDay: 14 * 3600 + 23 * 60,
  },
};
