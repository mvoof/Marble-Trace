import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '@store/root-store';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';

const sendPitOrderMock = vi.hoisted(() => vi.fn());

vi.mock('@platform/services/pit.service', () => ({
  sendPitOrder: sendPitOrderMock,
}));

// RootStore construction reaches the backend through the other services; they
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
  setCarLengthSilent: vi.fn(),
}));

// RootStore subscribes to sim events on construction; the node test
// environment has no window for the Tauri event bridge to attach to.
vi.mock('@platform/services/events.service', () => ({
  listenTo: vi.fn().mockResolvedValue(() => {}),
  emitToApp: vi.fn().mockResolvedValue(undefined),
  emitToWindow: vi.fn().mockResolvedValue(undefined),
  emitToOverlays: vi.fn().mockResolvedValue(undefined),
}));

describe('PitServiceWidgetStore — pit orders', () => {
  let rootStore: RootStore;

  // `enabled` comes from BaseUserSettings rather than the widget's own settings,
  // but auto mode depends on it, so the helper takes both.
  const setSettings = (
    partial: Partial<PitServiceWidgetSettings> & { enabled?: boolean }
  ) => {
    runInAction(() => {
      const settings =
        rootStore.widgetSettings.getSettings<PitServiceWidgetSettings>(
          'pit-service'
        );

      rootStore.widgetSettings.updateUserSettings('pit-service', {
        ...settings,
        ...partial,
      });
    });
  };

  const setFuelPlan = (toAdd: number | null, tankMax: number | null) => {
    runInAction(() => {
      rootStore.backendComputed.fuel = {
        fuelToAddWithBuffer: toAdd,
      } as never;

      rootStore.session.sessionInfo = {
        driverCarFuelMaxLtr: tankMax,
      } as never;
    });
  };

  const pitOrderPayloads = () =>
    sendPitOrderMock.mock.calls.map(([requests]) => ({ requests }));

  beforeEach(() => {
    sendPitOrderMock.mockReset();
    sendPitOrderMock.mockResolvedValue(undefined);
    rootStore = new RootStore();
  });

  it('caps the planned fuel at tank capacity', () => {
    setFuelPlan(120, 106);

    expect(rootStore.pitServiceWidget.plannedFuelLiters).toBe(106);
  });

  it('rounds fuel up so the order never lands a liter short', () => {
    setFuelPlan(25.2, 106);

    expect(rootStore.pitServiceWidget.plannedOrder).toEqual([
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

    expect(rootStore.pitServiceWidget.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'lf', value: 0 },
      { kind: 'rf', value: 0 },
      { kind: 'lr', value: 0 },
      { kind: 'rr', value: 0 },
    ]);
  });

  it('invokes the backend with the planned order', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.sendPlannedOrder();

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
    expect(rootStore.pitServiceWidget.lastOrderResult).toBe('sent');
  });

  it('reports a failed order instead of throwing', async () => {
    setFuelPlan(30, 106);
    sendPitOrderMock.mockRejectedValue(new Error('no broadcast message'));

    await rootStore.pitServiceWidget.sendPlannedOrder();

    expect(rootStore.pitServiceWidget.lastOrderResult).toBe('failed');
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

    await rootStore.pitServiceWidget.adjustFuel(
      rootStore.pitServiceWidget.fuelStepLiters
    );

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 41 }],
    });
  });

  it('steps by the configured amount, in the unit on display', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 40 });
    setSettings({ fuelAdjustStep: 5 });

    await rootStore.pitServiceWidget.adjustFuel(
      rootStore.pitServiceWidget.fuelStepLiters
    );

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 45 }],
    });
  });

  it('caps a manual fuel change at tank capacity', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.setFuelLiters(200);

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 106 }],
    });
  });

  it('clears fuel instead of ordering zero liters', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.setFuelLiters(0);

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clearFuel', value: 0 }],
    });
  });

  it('holds the drag in a draft and sends it once on release', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 10 });

    rootStore.pitServiceWidget.setFuelDraft(50);
    rootStore.pitServiceWidget.setFuelDraft(64);

    expect(rootStore.pitServiceWidget.fuelDisplayLiters).toBe(64);
    expect(sendPitOrderMock).not.toHaveBeenCalled();

    await rootStore.pitServiceWidget.commitFuelDraft();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'fuel', value: 64 }],
    });
    expect(rootStore.pitServiceWidget.fuelDraftLiters).toBeNull();
  });

  it('checks a single corner without touching the rest of the order', async () => {
    setPitService({ changeRf: true });

    await rootStore.pitServiceWidget.toggleTire('lf');

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

    await rootStore.pitServiceWidget.toggleTire('lf');

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

    await rootStore.pitServiceWidget.toggleAllTires();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clearTires', value: 0 }],
    });
  });

  it('sends the clear variant when a box is already checked', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fastRepair: true, cleanWindshield: false });

    await rootStore.pitServiceWidget.toggleFuel();
    await rootStore.pitServiceWidget.toggleFastRepair();
    await rootStore.pitServiceWidget.toggleWindshield();

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

      expect(rootStore.pitServiceWidget.isVisible).toBe(false);

      await rootStore.pitServiceWidget.toggleAllTires();

      expect(rootStore.pitServiceWidget.isVisible).toBe(true);

      vi.advanceTimersByTime(3999);

      expect(rootStore.pitServiceWidget.isVisible).toBe(true);

      vi.advanceTimersByTime(1);

      expect(rootStore.pitServiceWidget.isVisible).toBe(false);
      vi.useRealTimers();
    });

    // The bug this replaced a boolean edge for: a second key inside an open
    // window has to restart the countdown, and has to reach the overlay.
    it('restarts the countdown on every press, and reports every one', async () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      await rootStore.pitServiceWidget.toggleAllTires();

      const firstNonce = rootStore.pitServiceWidget.commandRevealNonce;

      vi.advanceTimersByTime(3000);
      await rootStore.pitServiceWidget.toggleFastRepair();

      expect(rootStore.pitServiceWidget.commandRevealNonce).toBe(
        firstNonce + 1
      );

      // Past the first press's deadline, still inside the second's.
      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.isVisible).toBe(true);

      vi.advanceTimersByTime(2000);

      expect(rootStore.pitServiceWidget.isVisible).toBe(false);
      vi.useRealTimers();
    });

    it('shows again right after it hid', async () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      await rootStore.pitServiceWidget.toggleAllTires();
      vi.advanceTimersByTime(4000);

      expect(rootStore.pitServiceWidget.isVisible).toBe(false);

      await rootStore.pitServiceWidget.toggleAllTires();

      expect(rootStore.pitServiceWidget.isVisible).toBe(true);
      vi.useRealTimers();
    });

    it('stays out of the way when the setting is zero', async () => {
      setSettings({ commandRevealSeconds: 0 });

      await rootStore.pitServiceWidget.toggleAllTires();

      expect(rootStore.pitServiceWidget.isVisible).toBe(false);
    });

    // Handing the stop over sends nothing, so it asks for the reveal itself.
    it('shows the panel for the auto mode key too', () => {
      setSettings({ enabled: true, autoFuel: true, commandRevealSeconds: 4 });

      rootStore.pitServiceWidget.toggleAutoSuspended();

      expect(rootStore.pitServiceWidget.isVisible).toBe(true);
    });

    // The temporary-show key is a latch the driver closes themselves; a timer
    // would take the box away mid-edit.
    it('leaves the temporary-show latch on its own', () => {
      vi.useFakeTimers();
      setSettings({ commandRevealSeconds: 4 });

      rootStore.pitServiceWidget.toggleManualShow();
      vi.advanceTimersByTime(10_000);

      expect(rootStore.pitServiceWidget.isVisible).toBe(true);
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
    // `enabled` matters as much as the auto switches: auto mode is inert for a
    // widget that is not in the active layout.
    const enableAuto = () =>
      setSettings({
        enabled: true,
        autoFuel: true,
        autoTires: true,
        autoTireWearThreshold: 60,
      });

    // On pit exit the sim checks a service set of its own — always all four
    // corners, the rest varying. Auto mode wipes that once per stint, away from
    // the box, so arrival has nothing to undo.
    describe('the order the sim arms by itself', () => {
      // With both halves auto mode's the whole order goes, and the SDK has no
      // batch form — one `clear` beats four broadcasts.
      it('wipes both halves auto mode owns with a single clear', async () => {
        enableAuto();

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        expect(pitOrderPayloads()[0]).toEqual({
          requests: [{ kind: 'clear', value: 0 }],
        });
      });

      // Auto mode never orders these two, but the sim ticks the windshield on
      // every exit, and a tear-off nobody chose is still a tear-off.
      it('wipes the windshield and fast repair the sim armed', async () => {
        enableAuto();
        rootStore.pitServiceWidget.setHalvesTakenOver(true, true);

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        // Both halves are the driver's, so there is nothing to wipe and the
        // imposed boxes are left with the rest of their order.
        expect(pitOrderPayloads()).toHaveLength(0);
      });

      it('wipes it once per stint', async () => {
        enableAuto();

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        expect(pitOrderPayloads()).toHaveLength(1);
      });

      it('wipes again on the stint after the next stop', async () => {
        enableAuto();

        await rootStore.pitServiceWidget.clearSelfArmedOrder();
        rootStore.pitServiceWidget.handlePitRoadChange(true);

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        expect(pitOrderPayloads()).toHaveLength(1);
      });

      // With auto mode off the armed order is something the driver may be
      // counting on, and taking it away unasked is the whole surprise to avoid.
      it('leaves it alone when auto mode is off', async () => {
        enableAuto();
        rootStore.pitServiceWidget.setAutoSuspended(true);

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        expect(pitOrderPayloads()).toHaveLength(0);
      });

      it('leaves a half the driver has taken over alone', async () => {
        enableAuto();
        rootStore.pitServiceWidget.setHalvesTakenOver(true, false);

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        expect(pitOrderPayloads()[0]).toEqual({
          requests: [
            { kind: 'clearTires', value: 0 },
            { kind: 'clearWindshield', value: 0 },
            { kind: 'clearFastRepair', value: 0 },
          ],
        });
      });

      it('sends nothing when auto mode owns neither half', async () => {
        setSettings({ enabled: true, autoFuel: false, autoTires: false });

        sendPitOrderMock.mockClear();
        await rootStore.pitServiceWidget.clearSelfArmedOrder();

        expect(pitOrderPayloads()).toHaveLength(0);
      });
    });

    it('orders only the corners worn past the threshold', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.55, rf: 0.62, lr: 0.9, rr: 0.6 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
          { kind: 'rr', value: 0 },
        ],
      });
    });

    // The whole point of the split: on pit road the sim still reports the
    // previous stop's tread, and only the reading taken in the box may decide
    // the order.
    it('orders tires from the wear read in the box, not on pit entry', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 1, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(pitOrderPayloads()).not.toContainEqual({
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });

      setTireWear({ lf: 0.3, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    // "Change nothing" is a decision auto mode has to enforce: the sim arms the
    // box with the previous stop's order by itself, so staying silent would
    // leave four tires ordered that the threshold said to keep.
    it('clears the tires when no corner is worn enough to change', async () => {
      enableAuto();
      setTireWear({ lf: 1, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toContainEqual({
        requests: [{ kind: 'clearTires', value: 0 }],
      });
    });

    // The fuel half runs before any tire wear is readable, so it must not touch
    // the tire side of the order the sim has armed.
    it('leaves the tires alone on pit entry', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(pitOrderPayloads()).toHaveLength(1);
      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
    });

    it('sends each half once per stop', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      sendPitOrderMock.mockClear();

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(sendPitOrderMock).not.toHaveBeenCalled();

      rootStore.pitServiceWidget.handlePitRoadChange(true);
      rootStore.pitServiceWidget.handlePitRoadChange(false);

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
    });

    it('takes the worst of the three points across the tread', () => {
      enableAuto();
      runInAction(() => {
        rootStore.player.chassis = {
          lf_wear_l: 0.4,
          lf_wear_m: 0.95,
          lf_wear_r: 0.95,
        } as never;
      });

      expect(rootStore.pitServiceWidget.autoTireCorners).toEqual(['lf']);
    });

    it('leaves out a section the driver switched off', async () => {
      setFuelPlan(30, 106);
      enableAuto();
      setSettings({ autoFuel: false });
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toHaveLength(1);
      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    it('marks the wear as stale everywhere but in the box', () => {
      enableAuto();
      setTireWear({ lf: 0.3 });

      expect(rootStore.pitServiceWidget.isTireWearStale).toBe(true);

      setPitService({ inPitStall: true });

      expect(rootStore.pitServiceWidget.isTireWearStale).toBe(false);
    });

    // Auto mode never orders a fast repair or a tear-off, so using one says
    // nothing about who is deciding the fuel or the tires.
    it('keeps both halves after a fast repair or a tear-off', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.toggleFastRepair();
      await rootStore.pitServiceWidget.toggleWindshield();

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('AUTO');

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toHaveLength(2);
    });

    it('stands both halves down when the driver takes the stop over', async () => {
      setFuelPlan(30, 106);
      enableAuto();
      setTireWear({ lf: 0.1 });

      rootStore.pitServiceWidget.setAutoSuspended(true);

      expect(rootStore.pitServiceWidget.isAutoActive).toBe(false);
      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('MANUAL');

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(sendPitOrderMock).not.toHaveBeenCalled();
    });

    // Auto mode doing its job is not the driver taking over: the two used to
    // share a flag, and the plate flipped to MANUAL the moment auto succeeded.
    it('still reads AUTO after auto mode has sent both halves', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toHaveLength(2);
      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('AUTO');
    });

    it('names the halves auto mode still owns', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setPitService({ addFuel: true, fuelAmount: 40 });
      setTireWear({ lf: 0.3 });

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('AUTO');

      await rootStore.pitServiceWidget.adjustFuel(
        rootStore.pitServiceWidget.fuelStepLiters
      );

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('TIRE AUTO');

      await rootStore.pitServiceWidget.toggleTire('rf');

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('MANUAL');
    });

    it('says FUEL AUTO once the tires are picked by hand', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.toggleAllTires();

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('FUEL AUTO');
    });

    it('has no plate at all while auto mode is switched off', () => {
      setSettings({ enabled: true, autoFuel: false, autoTires: false });

      expect(rootStore.pitServiceWidget.autoModeLabel).toBeNull();
    });

    // Correcting the fuel is the most ordinary thing a driver does on the way
    // in, and it says nothing at all about the tires.
    it('claims only the fuel half when the fuel is nudged by hand', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setPitService({ addFuel: true, fuelAmount: 40 });
      setTireWear({ lf: 0.3, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.adjustFuel(
        rootStore.pitServiceWidget.fuelStepLiters
      );

      expect(rootStore.pitServiceWidget.isAutoFuelPending).toBe(false);
      expect(rootStore.pitServiceWidget.isAutoTiresPending).toBe(true);

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toHaveLength(1);
      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    it('claims only the tire half when a corner is toggled by hand', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.toggleTire('rf');

      expect(rootStore.pitServiceWidget.isAutoTiresPending).toBe(false);
      expect(rootStore.pitServiceWidget.isAutoFuelPending).toBe(true);

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderPayloads()).toHaveLength(1);
      expect(pitOrderPayloads()).toContainEqual({
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
    });

    // Ordering the calculated amount by hand is a manual fuel decision like any
    // other: auto mode rewriting it on pit entry would undo a deliberate press.
    it('claims the fuel half when the calculated amount is ordered by key', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.toggleFuel();

      expect(pitOrderPayloads()).toContainEqual({
        requests: [{ kind: 'fuel', value: 25 }],
      });
      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('TIRE AUTO');

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(pitOrderPayloads()).toHaveLength(0);
    });

    // The way back into auto mode inside a stop. Without it a driver who has
    // corrected the fuel is stuck at FUEL AUTO until the next pit exit.
    it('restores both halves when the auto key is pressed from a half-manual stop', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setPitService({ addFuel: true, fuelAmount: 40 });

      await rootStore.pitServiceWidget.adjustFuel(
        rootStore.pitServiceWidget.fuelStepLiters
      );

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('TIRE AUTO');

      rootStore.pitServiceWidget.toggleAutoSuspended();

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('AUTO');
    });

    it('hands the stop to the driver when the auto key is pressed from AUTO', () => {
      enableAuto();

      rootStore.pitServiceWidget.toggleAutoSuspended();

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('MANUAL');

      rootStore.pitServiceWidget.toggleAutoSuspended();

      expect(rootStore.pitServiceWidget.autoModeLabel).toBe('AUTO');
    });

    // The off switch outlives the stop. Pit exit clearing it turned "I switched
    // auto off" into "auto is back on next lap", which is exactly the surprise
    // the switch exists to prevent.
    it('stays switched off across a pit stop', async () => {
      enableAuto();
      rootStore.pitServiceWidget.setAutoSuspended(true);

      rootStore.pitServiceWidget.handlePitRoadChange(true);
      rootStore.pitServiceWidget.handlePitRoadChange(false);

      expect(rootStore.pitServiceWidget.isAutoActive).toBe(false);
    });

    it('hands a half taken over by hand back on the next pit entry', async () => {
      enableAuto();
      await rootStore.pitServiceWidget.toggleFuel();

      expect(rootStore.pitServiceWidget.fuelTakenOver).toBe(true);

      rootStore.pitServiceWidget.handlePitRoadChange(true);
      rootStore.pitServiceWidget.handlePitRoadChange(false);

      expect(rootStore.pitServiceWidget.fuelTakenOver).toBe(false);
      expect(rootStore.pitServiceWidget.isAutoActive).toBe(true);
    });

    it('sends nothing when the widget is not in the active layout', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.1 });
      setSettings({ enabled: false });

      sendPitOrderMock.mockClear();

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(rootStore.pitServiceWidget.isAutoEnabled).toBe(false);
      expect(sendPitOrderMock).not.toHaveBeenCalled();
    });

    it('is off entirely when neither fuel nor tires are automatic', async () => {
      enableAuto();
      setSettings({ autoFuel: false, autoTires: false });
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(rootStore.pitServiceWidget.isAutoEnabled).toBe(false);
      expect(sendPitOrderMock).not.toHaveBeenCalled();
    });
  });

  describe('tire compound', () => {
    const setCompounds = (
      compounds: { tireIndex: number; tireCompoundType: string }[],
      ordered: number | null
    ) => {
      runInAction(() => {
        rootStore.session.sessionInfo = {
          driverCarFuelMaxLtr: 106,
          driverTires: compounds,
        } as never;

        rootStore.player.pitService = { tireCompound: ordered } as never;
      });
    };

    it('offers no choice when the car has a single compound', async () => {
      setCompounds([{ tireIndex: 0, tireCompoundType: 'Dry' }], 0);

      expect(rootStore.pitServiceWidget.hasCompoundChoice).toBe(false);

      sendPitOrderMock.mockClear();
      await rootStore.pitServiceWidget.cycleTireCompound();

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

      expect(rootStore.pitServiceWidget.hasCompoundChoice).toBe(true);
      expect(rootStore.pitServiceWidget.orderedCompoundName).toBe('Hard');
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
      await rootStore.pitServiceWidget.cycleTireCompound();

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

      await rootStore.pitServiceWidget.cycleTireCompound();

      expect(rootStore.pitServiceWidget.tiresTakenOver).toBe(true);
      expect(rootStore.pitServiceWidget.fuelTakenOver).toBe(false);
    });
  });

  it('clears the whole order with a single command', async () => {
    await rootStore.pitServiceWidget.sendClearOrder();

    expect(pitOrderPayloads()).toContainEqual({
      requests: [{ kind: 'clear', value: 0 }],
    });
  });
});
