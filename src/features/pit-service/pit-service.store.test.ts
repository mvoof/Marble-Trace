import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RendererCore } from '@app/roots/renderer-core';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';

// A running core whose widget settings the test writes, as main writes its own.
type WritableCore = RendererCore & { liveWidgets: LiveWidgetsStore };
import type { PitServiceWidgetSettings } from '@shared/contracts/widget-settings';
import type { PitStrategy } from '@shared/contracts/pit-strategy';
import type { PitAutoFrame } from '@shared/contracts/bindings';
import { PIT_LIMITER_BIT } from '@shared/lib/car-signals';

const runPitActionMock = vi.hoisted(() => vi.fn());
const togglePitAutoMock = vi.hoisted(() => vi.fn());

vi.mock('@shared/api/pit.service', () => ({
  runPitAction: runPitActionMock,
  togglePitAuto: togglePitAutoMock,
  setPitStrategySilent: vi.fn(),
}));

// RendererCore construction reaches the backend through the other services; they
// have no Tauri runtime to talk to under vitest.
vi.mock('@shared/api/telemetry.service', () => ({
  startTelemetryStream: vi.fn().mockResolvedValue(undefined),
  stopTelemetryStream: vi.fn().mockResolvedValue(undefined),
  getConnectionStatus: vi.fn().mockResolvedValue(false),
  getLastSessionInfo: vi.fn().mockResolvedValue(null),
  setActiveEventsSilent: vi.fn(),
}));
vi.mock('@shared/api/settings.service', () => ({
  setPitWarningLapsSilent: vi.fn(),
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));

// RendererCore subscribes to sim events on construction; the node test
// environment has no window for the Tauri event bridge to attach to.
vi.mock('@shared/api/events.service', () => ({
  listenTo: vi.fn().mockResolvedValue(() => {}),
  emitToApp: vi.fn().mockResolvedValue(undefined),
  emitToWindow: vi.fn().mockResolvedValue(undefined),
  emitToOverlays: vi.fn().mockResolvedValue(undefined),
}));

describe('PitServiceWidgetStore — pit orders', () => {
  let rootStore: WritableCore;

  // `enabled` comes from BaseUserSettings rather than the widget's own settings,
  // but auto mode depends on it, so the helper takes both. The strategy is the
  // app's, not the widget's — `setStrategy` below.
  const setSettings = (
    partial: Partial<PitServiceWidgetSettings> & { enabled?: boolean }
  ) => {
    runInAction(() => {
      const settings =
        rootStore.liveWidgets.getSettings<PitServiceWidgetSettings>(
          'pit-service'
        );

      rootStore.liveWidgets.updateUserSettings('pit-service', {
        ...settings,
        ...partial,
      });
    });
  };

  const setStrategy = (partial: Partial<PitStrategy>) => {
    runInAction(() =>
      rootStore.appSettings.setPitStrategy(partial as PitStrategy)
    );
  };

  // The split across stops is the backend's now, so the fixture seeds the
  // frame the widget actually reads rather than the two inputs it used to
  // divide itself.
  const setFuelPlan = (toAdd: number | null, tankMax: number | null) => {
    const fillNow =
      toAdd === null || toAdd <= 0
        ? null
        : tankMax === null || tankMax <= 0
          ? toAdd
          : Math.min(toAdd, tankMax);

    runInAction(() => {
      rootStore.backendComputed.fuel = {
        fuelToAddWithBuffer: toAdd,
        refuelPlan:
          fillNow === null
            ? null
            : {
                stops:
                  tankMax !== null && tankMax > 0
                    ? Math.ceil(toAdd! / tankMax)
                    : 1,
                fillNow,
              },
      } as never;

      rootStore.session.sessionInfo = {
        fuelCapacityLtr: tankMax,
      } as never;
    });
  };

  // The arithmetic of an order — rounding, the cap, the corner dance, the
  // claim — is the telemetry thread's (`computations/pit_actions.rs`). What the
  // widget owns is which intent a click sends.
  const sentActions = () =>
    runPitActionMock.mock.calls.map(([action]) => action as unknown);

  // An order the telemetry thread sent, manual or automatic, as the widget
  // learns of it: the count on the published frame steps.
  const setPitAuto = (frame: Partial<PitAutoFrame> | null) => {
    runInAction(() => {
      rootStore.backendComputed.pitAuto =
        frame === null
          ? null
          : { mode: 'auto', ordersSent: 0, lastOrderOk: null, ...frame };
    });
  };

  let ordersSent = 0;

  const reportOrderSent = () => {
    ordersSent++;
    setPitAuto({ ordersSent, lastOrderOk: true });
  };

  beforeEach(() => {
    runPitActionMock.mockReset();
    runPitActionMock.mockResolvedValue(undefined);
    togglePitAutoMock.mockReset();
    togglePitAutoMock.mockResolvedValue(undefined);
    ordersSent = 0;
    rootStore = new RendererCore() as WritableCore;
  });

  it('caps the planned fuel at tank capacity', () => {
    setFuelPlan(120, 106);

    expect(rootStore.pitServiceWidget.order.plannedFuelLiters).toBe(106);
  });

  it('reports an order that never reached the backend', async () => {
    runPitActionMock.mockRejectedValue(new Error('no backend'));

    rootStore.pitServiceWidget.order.toggleFuel();

    await vi.waitFor(() =>
      expect(rootStore.pitServiceWidget.order.lastOrderResult).toBe('failed')
    );
  });

  const setPitService = (partial: Record<string, unknown>) => {
    runInAction(() => {
      rootStore.player.pitService = {
        changeLf: false,
        changeRf: false,
        changeLr: false,
        changeRr: false,
        addFuel: false,
        fastRepair: false,
        cleanWindshield: false,
        ...partial,
      } as never;
    });
  };

  it('holds the drag in a draft and sends it once on release', () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 10 });

    rootStore.pitServiceWidget.order.setFuelDraft(50);
    rootStore.pitServiceWidget.order.setFuelDraft(64);

    expect(rootStore.pitServiceWidget.order.fuelDisplayLiters).toBe(64);
    expect(runPitActionMock).not.toHaveBeenCalled();

    rootStore.pitServiceWidget.order.commitFuelDraft();

    expect(sentActions()).toEqual([{ kind: 'setFuel', liters: 64 }]);
    expect(rootStore.pitServiceWidget.order.fuelDraftLiters).toBeNull();
  });

  it('caps the draft at the room left in the tank', () => {
    setFuelPlan(30, 106);

    rootStore.pitServiceWidget.order.setFuelDraft(200);

    expect(rootStore.pitServiceWidget.order.fuelDraftLiters).toBe(106);
  });

  it('sends each click as the intent it stands for', () => {
    const order = rootStore.pitServiceWidget.order;

    order.toggleFuel();
    order.toggleTire('rf');
    order.cycleTireCompound();
    order.toggleFastRepair();
    order.toggleWindshield();

    expect(sentActions()).toEqual([
      { kind: 'toggleFuel' },
      { kind: 'toggleTire', corner: 'rf' },
      { kind: 'cycleCompound' },
      { kind: 'toggleFastRepair' },
      { kind: 'toggleWindshield' },
    ]);
  });

  describe('reveal after a command', () => {
    beforeEach(() => {
      rootStore.pitServiceWidget.init();
      setPitAuto({ ordersSent: 0 });
    });

    it('shows the panel for the configured seconds, then hides it again', () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);

      reportOrderSent();

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);

      vi.advanceTimersByTime(3999);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);

      vi.advanceTimersByTime(1);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);
      vi.useRealTimers();
    });

    // A second key inside an open window has to restart the countdown.
    it('restarts the countdown on every order', () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      reportOrderSent();
      vi.advanceTimersByTime(3000);
      reportOrderSent();

      // Past the first press's deadline, still inside the second's.
      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);

      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);
      vi.useRealTimers();
    });

    it('shows again right after it hid', () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      reportOrderSent();
      vi.advanceTimersByTime(4000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);

      reportOrderSent();

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);
      vi.useRealTimers();
    });

    it('stays out of the way when the setting is zero', () => {
      setSettings({ commandRevealSeconds: 0 });

      reportOrderSent();

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);
    });

    // Handing the stop over sends nothing, so it asks for the reveal itself.
    it('shows the panel for the auto mode key too', () => {
      setSettings({ enabled: true, commandRevealSeconds: 4 });
      setStrategy({ pitAutoFuel: true });

      rootStore.pitServiceWidget.auto.toggleAutoSuspended();

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);
    });

    // The temporary-show key is a latch the driver closes themselves; a timer
    // would take the box away mid-edit.
    it('leaves the temporary-show latch on its own', () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      rootStore.pitServiceWidget.panel.toggleManualShow();
      vi.advanceTimersByTime(10_000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);
      vi.useRealTimers();
    });
  });

  const setTireWear = (wearByCorner: Record<string, number>) => {
    runInAction(() => {
      const chassis: Record<string, number> = {};

      for (const [corner, wear] of Object.entries(wearByCorner)) {
        chassis[`${corner}_wear_l`] = wear;
        chassis[`${corner}_wear_m`] = wear;
        chassis[`${corner}_wear_r`] = wear;
      }

      rootStore.player.chassis = chassis as never;
    });
  };

  describe('auto mode', () => {
    // The decisions are the telemetry thread's (`computations/pit_auto.rs`);
    // the widget reports what it publishes.
    it('names the halves auto mode still owns', () => {
      setPitAuto({ mode: 'auto' });

      expect(rootStore.pitServiceWidget.auto.autoModeLabel).toBe('AUTO');

      setPitAuto({ mode: 'tireAuto' });

      expect(rootStore.pitServiceWidget.auto.autoModeLabel).toBe('TIRE AUTO');

      setPitAuto({ mode: 'fuelAuto' });

      expect(rootStore.pitServiceWidget.auto.autoModeLabel).toBe('FUEL AUTO');

      setPitAuto({ mode: 'manual' });

      expect(rootStore.pitServiceWidget.auto.autoModeLabel).toBe('MANUAL');
    });

    it('has no plate at all while auto mode is switched off', () => {
      expect(rootStore.pitServiceWidget.auto.autoModeLabel).toBeNull();

      setPitAuto({ mode: 'off' });

      expect(rootStore.pitServiceWidget.auto.autoModeLabel).toBeNull();
    });

    it('sends the auto mode key to the backend', () => {
      rootStore.pitServiceWidget.auto.toggleAutoSuspended();

      expect(togglePitAutoMock).toHaveBeenCalledTimes(1);
    });

    it('marks the wear as stale everywhere but in the box', () => {
      setTireWear({ lf: 0.3 });

      expect(rootStore.pitServiceWidget.auto.isTireWearStale).toBe(true);

      setPitService({ inPitStall: true });

      expect(rootStore.pitServiceWidget.auto.isTireWearStale).toBe(false);
    });

    describe('an order auto mode sent', () => {
      beforeEach(() => {
        rootStore.pitServiceWidget.init();
        setSettings({ commandRevealSeconds: 4 });
      });

      it('reveals the panel and reports the order, as a key press does', () => {
        setPitAuto({ ordersSent: 3 });
        setPitAuto({ ordersSent: 4, lastOrderOk: true });

        expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);
        expect(rootStore.pitServiceWidget.order.lastOrderResult).toBe('sent');
      });

      it('reports one that failed to leave', () => {
        setPitAuto({ ordersSent: 0 });
        setPitAuto({ ordersSent: 1, lastOrderOk: false });

        expect(rootStore.pitServiceWidget.order.lastOrderResult).toBe('failed');
      });

      // A window opened mid-session receives the count so far — history, not
      // an order going out now.
      it('ignores the count on the first frame a window receives', () => {
        setPitAuto({ ordersSent: 7, lastOrderOk: true });

        expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);
        expect(rootStore.pitServiceWidget.order.lastOrderResult).toBeNull();
      });
    });
  });

  describe('tire compound', () => {
    const setCompounds = (
      compounds: { tireIndex: number; tireCompoundType: string }[],
      ordered: number | null
    ) => {
      runInAction(() => {
        rootStore.session.sessionInfo = {
          fuelCapacityLtr: 106,
          driverTires: compounds,
        } as never;

        rootStore.player.pitService = { tireCompound: ordered } as never;
      });
    };

    it('offers no choice when the car has a single compound', () => {
      setCompounds([{ tireIndex: 0, tireCompoundType: 'Dry' }], 0);

      expect(rootStore.pitServiceWidget.order.hasCompoundChoice).toBe(false);
    });

    it('names the compound the sim has on the order', () => {
      setCompounds(
        [
          { tireIndex: 0, tireCompoundType: 'Soft' },
          { tireIndex: 1, tireCompoundType: 'Hard' },
        ],
        1
      );

      expect(rootStore.pitServiceWidget.order.hasCompoundChoice).toBe(true);
      expect(rootStore.pitServiceWidget.order.orderedCompoundName).toBe('Hard');
    });
  });

  describe('when the pit limit stops binding', () => {
    const LAP_LENGTH_M = 4000;
    const PIT_IN_PCT = 0.5;

    const placeCar = (options: {
      onPitRoad: boolean;
      limiter?: boolean;
      lapDistPct?: number;
    }) => {
      runInAction(() => {
        rootStore.player.carStatus = {
          on_pit_road: options.onPitRoad,
          engine_warnings: options.limiter === true ? PIT_LIMITER_BIT : 0,
        } as never;

        rootStore.player.lapTiming = {
          lap_dist_pct: options.lapDistPct ?? 0,
        } as never;

        rootStore.trackMapWidget.trackShape = {
          pitInPct: PIT_IN_PCT,
        } as never;

        rootStore.session.sessionInfo = {
          trackLengthM: LAP_LENGTH_M,
        } as never;
      });
    };

    it('releases the car once it is out of the pits', () => {
      setSettings({ revealOnApproachM: 400 });
      placeCar({ onPitRoad: false, lapDistPct: PIT_IN_PCT + 0.25 });

      expect(rootStore.pitServiceWidget.isPitLimitReleased).toBe(true);
    });

    it('keeps policing the speed while the car is on pit road', () => {
      placeCar({ onPitRoad: true });

      expect(rootStore.pitServiceWidget.isPitLimitReleased).toBe(false);
    });

    it('keeps policing it while the limiter is engaged off pit road', () => {
      placeCar({ onPitRoad: false, limiter: true });

      expect(rootStore.pitServiceWidget.isPitLimitReleased).toBe(false);
      expect(rootStore.pitServiceWidget.isLimiterOn).toBe(true);
    });

    // The widget shows itself on the way in, and a green "GO" in front of a
    // driver braking for the entry is the opposite of what they need.
    it('does not release the car on the approach the widget appeared for', () => {
      setSettings({ revealOnApproachM: 400 });
      // 200 m short of the entry line on a 4 km lap.
      placeCar({ onPitRoad: false, lapDistPct: PIT_IN_PCT - 0.05 });

      expect(rootStore.pitServiceWidget.isApproachingPit).toBe(true);
      expect(rootStore.pitServiceWidget.isPitLimitReleased).toBe(false);
    });
  });

  // The stop is timed on the telemetry thread; the panel runs the clock
  // between its frames and takes the last stop from it, so a window opened
  // mid-session knows both.
  describe('the stop clock', () => {
    const setPitStops = (
      serviceElapsedS: number | null,
      lastServiceS: number | null = null
    ) => {
      runInAction(() =>
        rootStore.backendComputed.updatePitStops({
          playerStops: 1,
          serviceElapsedS,
          lastServiceS,
        })
      );
    };

    beforeEach(() => {
      vi.useFakeTimers();
      rootStore.pitServiceWidget.init();
    });

    it('runs between frames from where the backend says the stop is', () => {
      setPitStops(4);

      expect(rootStore.pitServiceWidget.panel.stopElapsedS).toBe(4);

      vi.advanceTimersByTime(1000);

      expect(rootStore.pitServiceWidget.panel.stopElapsedS).toBeCloseTo(5, 1);
      vi.useRealTimers();
    });

    it('is pulled back only when it has drifted from the backend', () => {
      setPitStops(4);
      vi.advanceTimersByTime(200);
      setPitStops(4.1);

      expect(rootStore.pitServiceWidget.panel.stopElapsedS).toBeCloseTo(4.2, 1);

      setPitStops(9);

      expect(rootStore.pitServiceWidget.panel.stopElapsedS).toBe(9);
      vi.useRealTimers();
    });

    it('stops with the service and keeps its figure', () => {
      setPitStops(4);
      vi.advanceTimersByTime(500);
      setPitStops(null, 4.5);

      const shown = rootStore.pitServiceWidget.panel.stopElapsedS;

      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.panel.stopElapsedS).toBe(shown);
      vi.useRealTimers();
    });

    it('takes the last stop from the backend, not from its own history', () => {
      setPitStops(null, 23.5);

      expect(rootStore.pitServiceWidget.panel.lastStopDurationS).toBe(23.5);
      vi.useRealTimers();
    });
  });
});
