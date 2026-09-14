import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  SessionEntry,
  SessionFrame,
  SessionState as BindingSessionState,
  SessionType,
} from '@/types/bindings';
import { mockSession, mockSessionEntry } from '@store/preview/mocks/timing';
import { whenSet } from '@/storybook/story-overrides';
import { TimerWidget } from './TimerWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

const SESSION_FLAG_CHECKERED = 0x0001;

interface StoryArgs {
  /**
   * The session clock and the entry that says how it ends. Left undefined —
   * which is what a story naming a scenario does — the base's own session is
   * kept, so a knob states a difference rather than replacing it.
   */
  sessionType?: SessionType;
  sessionTypeLabel?: string;
  sessionLaps?: string;
  remainSec?: number | null;
  elapsedSec?: number;
  simTimeOfDay?: number | null;
  checkered?: boolean;
  sessionState?: BindingSessionState;
  currentLap?: number;

  showLaps: boolean;
  showPosition: boolean;
  showWallClock: boolean;
  showSimTime: boolean;
  showPcDate: boolean;
  showSimDate: boolean;
}

// Only the knobs a story actually turned reach the frame; everything else is
// left to the scenario or the snapshot underneath.
const sessionOverrides = (args: StoryArgs): Partial<SessionFrame> => ({
  ...whenSet(args.remainSec, (remain) => ({ session_time_remain: remain })),
  ...whenSet(args.elapsedSec, (elapsed) => ({ session_time: elapsed })),
  ...whenSet(args.simTimeOfDay, (timeOfDay) => ({
    session_time_of_day: timeOfDay,
  })),
  ...whenSet(args.checkered, (checkered) => ({
    session_flags: checkered ? SESSION_FLAG_CHECKERED : 0,
  })),
  ...whenSet(args.sessionState, (state) => ({ session_state: state })),
});

const entryOverrides = (args: StoryArgs): Partial<SessionEntry> => ({
  ...whenSet(args.sessionType, (sessionType) => ({ sessionType })),
  ...whenSet(args.sessionTypeLabel, (sessionTypeLabel) => ({
    sessionTypeLabel,
  })),
  ...whenSet(args.sessionLaps, (sessionLaps) => ({ sessionLaps })),
});

const meta: Meta<StoryArgs> = {
  title: 'Widgets/TimerWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: TimerWidget,
    size: { width: 240, height: 120 },
    seedSnapshot: true,
    seed: (store, args) => {
      const sessionInfo = store.session.sessionInfo;
      const clock = sessionOverrides(args);
      const entry = entryOverrides(args);

      if (Object.keys(clock).length > 0) {
        store.session.updateSession(
          mockSession({ ...store.session.session, ...clock })
        );
      }

      // Which of the clock and the lap count the timer reads is decided by the
      // session entry, so the entry the frame points at is the one restated.
      const sessionNum = store.session.session?.session_num ?? 0;

      if (sessionInfo && Object.keys(entry).length > 0) {
        const sessions = [...sessionInfo.sessions];

        sessions[sessionNum] = mockSessionEntry({
          ...sessions[sessionNum],
          ...entry,
        });

        store.session.updateSessionInfo({
          ...sessionInfo,
          currentSessionNum: sessionNum,
          sessions,
        });
      }

      const carIdx = store.cars.carIdx;

      if (carIdx && args.currentLap !== undefined) {
        const lapByCar = [...carIdx.car_idx_lap];

        lapByCar[sessionInfo?.playerCarIdx ?? 0] = args.currentLap;
        store.cars.updateCarIdx({ ...carIdx, car_idx_lap: lapByCar });
      }

      store.liveWidgets.updateUserSettings('timer', {
        showLaps: args.showLaps,
        showPosition: args.showPosition,
        showWallClock: args.showWallClock,
        showSimTime: args.showSimTime,
        showPcDate: args.showPcDate,
        showSimDate: args.showSimDate,
      });
    },
    args: {
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

export const RaceGreen: Story = {
  args: {
    sessionType: 'Race',
    sessionTypeLabel: 'Race',
    sessionLaps: '30',
    remainSec: 42 * 60 + 18,
    elapsedSec: 0,
    currentLap: 12,
  },
};

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
  },
};

export const OpenQualify: Story = {
  args: { ...LoneQualify.args, sessionTypeLabel: 'Open Qualify' },
};

export const FinalMinutes: Story = {
  args: { ...RaceGreen.args, remainSec: 4 * 60 + 55 },
};

// The last minute of a timed race, which is when the clock gets its critical
// treatment.
export const FinalMinute: Story = {
  parameters: previewScenario('timer-final-minute'),
};

// A race that ends on a lap count has no clock at all: the timer counts up from
// the elapsed time instead.
export const LapLimited: Story = {
  parameters: previewScenario('timer-lap-limited'),
};

export const Checkered: Story = {
  args: { ...RaceGreen.args, remainSec: 0, checkered: true, currentLap: 30 },
};

export const SessionEnded: Story = {
  args: { ...RaceGreen.args, sessionState: 'CoolDown' },
};

export const WithClocks: Story = {
  args: {
    ...RaceGreen.args,
    showWallClock: true,
    showSimTime: true,
    simTimeOfDay: 16 * 3600,
  },
};

export const MinimalView: Story = {
  args: { ...RaceGreen.args, showLaps: false, showPosition: false },
};

export const TimedRace: Story = {
  args: {
    ...RaceGreen.args,
    sessionLaps: 'unlimited',
    remainSec: 30 * 60,
    currentLap: 8,
  },
};

export const WithDates: Story = {
  args: {
    ...RaceGreen.args,
    showWallClock: true,
    showSimTime: true,
    showPcDate: true,
    showSimDate: true,
    simTimeOfDay: 14 * 3600 + 23 * 60,
  },
};
