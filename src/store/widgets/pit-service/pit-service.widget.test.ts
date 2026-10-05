import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RendererCore } from '@store/renderer-core';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import type { PitStrategy } from '@/types/pit-strategy';
import type { PitAutoFrame } from '@/types/bindings';
import { PIT_LIMITER_BIT } from '@utils/car-signals';

const sendPitOrderMock = vi.hoisted(() => vi.fn());
const togglePitAutoMock = vi.hoisted(() => vi.fn());

vi.mock('@platform/services/pit.service', () => ({
  sendPitOrder: sendPitOrderMock,
  togglePitAuto: togglePitAutoMock,
  setPitStrategySilent: vi.fn(),
}));

// RendererCore construction reaches the backend through the other services; they
// have no Tauri runtime to talk to under vitest.
vi.mock('@platform/services/telemetry.service', () => ({
  startTelemetryStream: vi.fn().mockResolvedValue(undefined),
  stopTelemetryStream: vi.fn().mockResolvedValue(undefined),
  getConnectionStatus: vi.fn().mockResolvedValue(false),
  getLastSessionInfo: vi.fn().mockResolvedValue(null),
  setActiveEventsSilent: vi.fn(),
}));
vi.mock('@platform/services/settings.service', () => ({
  setPitWarningLapsSilent: vi.fn(),
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));

// RendererCore subscribes to sim events on construction; the node test
// environment has no window for the Tauri event bridge to attach to.
vi.mock('@platform/services/events.service', () => ({
  listenTo: vi.fn().mockResolvedValue(() => {}),
  emitToApp: vi.fn().mockResolvedValue(undefined),
  emitToWindow: vi.fn().mockResolvedValue(undefined),
  emitToOverlays: vi.fn().mockResolvedValue(undefined),
}));

describe('PitServiceWidgetStore — pit orders', () => {
  let rootStore: RendererCore;

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

  const pitOrderPayloads = () =>
    sendPitOrderMock.mock.calls.map(([requests]) => ({ requests }));

  beforeEach(() => {
    sendPitOrderMock.mockReset();
    sendPitOrderMock.mockResolvedValue(undefined);
    togglePitAutoMock.mockReset();
    togglePitAutoMock.mockResolvedValue(undefined);
    rootStore = new RendererCore();
  });

  it('caps the planned fuel at tank capacity', () => {
    setFuelPlan(120, 106);

    expect(rootStore.pitServiceWidget.order.plannedFuelLiters).toBe(106);
  });

  it('rounds fuel up so the order never lands a liter short', () => {
    setFuelPlan(25.2, 106);

    expect(rootStore.pitServiceWidget.order.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'fuel', value: 26 },
      { kind: 'lf', value: 0 },
      { kind: 'rf', value: 0 },
      { kind: 'lr', value: 0 },
      { kind: 'rr', value: 0 },
    ]);
  });

  it('omits fuel entirely when none is needed', () => {
    setFuelPlan(null, 106);

    expect(rootStore.pitServiceWidget.order.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'lf', value: 0 },
      { kind: 'rf', value: 0 },
      { kind: 'lr', value: 0 },
      { kind: 'rr', value: 0 },
    ]);
  });

  it('invokes the backend with the planned order', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.order.sendPlannedOrder();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [
        { kind: 'clear', value: 0 },
        { kind: 'fuel', value: 30 },
        { kind: 'lf', value: 0 },
        { kind: 'rf', value: 0 },
        { kind: 'lr', value: 0 },
        { kind: 'rr', value: 0 },
      ],
    });
    expect(rootStore.pitServiceWidget.order.lastOrderResult).toBe('sent');
  });

  it('reports a failed order instead of throwing', async () => {
    setFuelPlan(30, 106);
    sendPitOrderMock.mockRejectedValue(new Error('no broadcast message'));

    await rootStore.pitServiceWidget.order.sendPlannedOrder();

    expect(rootStore.pitServiceWidget.order.lastOrderResult).toBe('failed');
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

  it('steps the ordered fuel up from what the sim currently holds', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 40 });

    await rootStore.pitServiceWidget.order.adjustFuel(
      rootStore.pitServiceWidget.order.fuelStepLiters
    );

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 41 }],
    });
  });

  it('steps by the configured amount, in the unit on display', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 40 });
    setStrategy({ pitFuelAdjustStep: 5 });

    await rootStore.pitServiceWidget.order.adjustFuel(
      rootStore.pitServiceWidget.order.fuelStepLiters
    );

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 45 }],
    });
  });

  it('caps a manual fuel change at tank capacity', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.order.setFuelLiters(200);

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 106 }],
    });
  });

  it('clears fuel instead of ordering zero liters', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.order.setFuelLiters(0);

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clearFuel', value: 0 }],
    });
  });

  it('holds the drag in a draft and sends it once on release', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 10 });

    rootStore.pitServiceWidget.order.setFuelDraft(50);
    rootStore.pitServiceWidget.order.setFuelDraft(64);

    expect(rootStore.pitServiceWidget.order.fuelDisplayLiters).toBe(64);
    expect(sendPitOrderMock).not.toHaveBeenCalled();

    await rootStore.pitServiceWidget.order.commitFuelDraft();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 64 }],
    });
    expect(rootStore.pitServiceWidget.order.fuelDraftLiters).toBeNull();
  });

  it('checks a single corner without touching the rest of the order', async () => {
    setPitService({ changeRf: true });

    await rootStore.pitServiceWidget.order.toggleTire('lf');

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'lf', value: 0 }],
    });
  });

  it('unchecks one corner by clearing all four and restoring the others', async () => {
    setPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      rfPressure: 165,
      lrPressure: null,
    });

    await rootStore.pitServiceWidget.order.toggleTire('lf');

    expect(pitOrderPayloads()).toContainEqual({
      requests: [
        { kind: 'clearTires', value: 0 },
        { kind: 'rf', value: 165 },
        { kind: 'lr', value: 0 },
      ],
    });
  });

  it('clears the tires only when all four are already ordered', async () => {
    setPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      changeRr: true,
    });

    await rootStore.pitServiceWidget.order.toggleAllTires();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clearTires', value: 0 }],
    });
  });

  it('sends the clear variant when a box is already checked', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fastRepair: true, cleanWindshield: false });

    await rootStore.pitServiceWidget.order.toggleFuel();
    await rootStore.pitServiceWidget.order.toggleFastRepair();
    await rootStore.pitServiceWidget.order.toggleWindshield();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clearFuel', value: 0 }],
    });
    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clearFastRepair', value: 0 }],
    });
    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'windshield', value: 0 }],
    });
  });

  describe('reveal after a command', () => {
    it('shows the panel for the configured seconds, then hides it again', async () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);

      await rootStore.pitServiceWidget.order.toggleAllTires();

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);

      vi.advanceTimersByTime(3999);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);

      vi.advanceTimersByTime(1);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);
      vi.useRealTimers();
    });

    // The bug this replaced a boolean edge for: a second key inside an open
    // window has to restart the countdown, and has to reach the overlay.
    it('restarts the countdown on every press, and reports every one', async () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      await rootStore.pitServiceWidget.order.toggleAllTires();

      const firstNonce = rootStore.pitServiceWidget.panel.commandRevealNonce;

      vi.advanceTimersByTime(3000);
      await rootStore.pitServiceWidget.order.toggleFastRepair();

      expect(rootStore.pitServiceWidget.panel.commandRevealNonce).toBe(
        firstNonce + 1
      );

      // Past the first press's deadline, still inside the second's.
      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);

      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);
      vi.useRealTimers();
    });

    it('shows again right after it hid', async () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      await rootStore.pitServiceWidget.order.toggleAllTires();
      vi.advanceTimersByTime(4000);

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(false);

      await rootStore.pitServiceWidget.order.toggleAllTires();

      expect(rootStore.pitServiceWidget.panel.isVisible).toBe(true);
      vi.useRealTimers();
    });

    it('stays out of the way when the setting is zero', async () => {
      setSettings({ commandRevealSeconds: 0 });

      await rootStore.pitServiceWidget.order.toggleAllTires();

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
    // the widget reports what it publishes and hands over what a manual order
    // claims.
    const setPitAuto = (frame: Partial<PitAutoFrame> | null) => {
      runInAction(() => {
        rootStore.backendComputed.pitAuto =
          frame === null
            ? null
            : { mode: 'auto', ordersSent: 0, lastOrderOk: null, ...frame };
      });
    };

    const claimOfLastOrder = () => sendPitOrderMock.mock.calls.at(-1)?.[1];

    it('claims only the fuel half when the fuel is nudged by hand', async () => {
      setFuelPlan(24.1, 106);
      setPitService({ addFuel: true, fuelAmount: 40 });

      await rootStore.pitServiceWidget.order.adjustFuel(
        rootStore.pitServiceWidget.order.fuelStepLiters
      );

      expect(claimOfLastOrder()).toEqual({ fuel: true, tires: false });
    });

    it('claims the fuel half when the calculated amount is ordered by key', async () => {
      setFuelPlan(24.1, 106);

      await rootStore.pitServiceWidget.order.toggleFuel();

      expect(pitOrderPayloads()).toContainEqual({
        requests: [{ kind: 'fuel', value: 25 }],
      });
      expect(claimOfLastOrder()).toEqual({ fuel: true, tires: false });
    });

    it('claims only the tire half when a corner is toggled by hand', async () => {
      await rootStore.pitServiceWidget.order.toggleTire('rf');

      expect(claimOfLastOrder()).toEqual({ fuel: false, tires: true });

      await rootStore.pitServiceWidget.order.toggleAllTires();

      expect(claimOfLastOrder()).toEqual({ fuel: false, tires: true });
    });

    it('claims the whole stop with the planned or the clear order', async () => {
      setFuelPlan(24.1, 106);

      await rootStore.pitServiceWidget.order.sendPlannedOrder();

      expect(claimOfLastOrder()).toEqual({ fuel: true, tires: true });

      await rootStore.pitServiceWidget.order.sendClearOrder();

      expect(claimOfLastOrder()).toEqual({ fuel: true, tires: true });
    });

    // Auto mode never orders a fast repair or a tear-off, so using one says
    // nothing about who is deciding the fuel or the tires.
    it('claims nothing with a fast repair or a tear-off', async () => {
      await rootStore.pitServiceWidget.order.toggleFastRepair();

      expect(claimOfLastOrder()).toBeUndefined();

      await rootStore.pitServiceWidget.order.toggleWindshield();

      expect(claimOfLastOrder()).toBeUndefined();
    });

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

    it('offers no choice when the car has a single compound', async () => {
      setCompounds([{ tireIndex: 0, tireCompoundType: 'Dry' }], 0);

      expect(rootStore.pitServiceWidget.order.hasCompoundChoice).toBe(false);

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.order.cycleTireCompound();

      expect(pitOrderPayloads()).toHaveLength(0);
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

    it('steps to the next compound and wraps at the end', async () => {
      setCompounds(
        [
          { tireIndex: 0, tireCompoundType: 'Soft' },
          { tireIndex: 1, tireCompoundType: 'Hard' },
        ],
        1
      );

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.order.cycleTireCompound();

      expect(pitOrderPayloads()[0]).toEqual({
        requests: [{ kind: 'tireCompound', value: 0 }],
      });
    });

    // Picking a compound is a tire decision, so it takes the tire half over —
    // and leaves the fuel half exactly where it was.
    it('claims the tire half only', async () => {
      setCompounds(
        [
          { tireIndex: 0, tireCompoundType: 'Soft' },
          { tireIndex: 1, tireCompoundType: 'Hard' },
        ],
        0
      );

      await rootStore.pitServiceWidget.order.cycleTireCompound();

      expect(sendPitOrderMock.mock.calls.at(-1)?.[1]).toEqual({
        fuel: false,
        tires: true,
      });
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

  it('clears the whole order with a single command', async () => {
    await rootStore.pitServiceWidget.order.sendClearOrder();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clear', value: 0 }],
    });
  });
});
