import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

// RootStore subscribes to sim events on construction; the node test
// environment has no window for the Tauri event bridge to attach to.
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

describe('PitServiceWidgetStore — pit orders', () => {
  let rootStore: RootStore;

  const setSettings = (partial: Partial<PitServiceWidgetSettings>) => {
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

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
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

  it('sends nothing while commands are disabled', async () => {
    setFuelPlan(30, 106);
    setSettings({ enableCommands: false });

    await rootStore.pitServiceWidget.sendPlannedOrder();
    await rootStore.pitServiceWidget.sendClearOrder();

    // RootStore itself invokes unrelated commands on construction, so assert on
    // the pit channel rather than on the mock as a whole.
    expect(invokeMock).not.toHaveBeenCalledWith(
      'send_pit_order',
      expect.anything()
    );
  });

  it('invokes the backend once commands are enabled', async () => {
    setFuelPlan(30, 106);
    setSettings({ enableCommands: true });

    await rootStore.pitServiceWidget.sendPlannedOrder();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
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
    setSettings({ enableCommands: true });
    invokeMock.mockRejectedValue(new Error('no broadcast message'));

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

  it('checks a single corner without touching the rest of the order', async () => {
    setSettings({ enableCommands: true });
    setPitService({ changeRf: true });

    await rootStore.pitServiceWidget.toggleTire('lf');

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'lf', value: 0 }],
    });
  });

  it('unchecks one corner by clearing all four and restoring the others', async () => {
    setSettings({ enableCommands: true });
    setPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      rfPressure: 165,
      lrPressure: null,
    });

    await rootStore.pitServiceWidget.toggleTire('lf');

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [
        { kind: 'clearTires', value: 0 },
        { kind: 'rf', value: 165 },
        { kind: 'lr', value: 0 },
      ],
    });
  });

  it('clears the tires only when all four are already ordered', async () => {
    setSettings({ enableCommands: true });
    setPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      changeRr: true,
    });

    await rootStore.pitServiceWidget.toggleAllTires();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearTires', value: 0 }],
    });
  });

  it('sends the clear variant when a box is already checked', async () => {
    setFuelPlan(30, 106);
    setSettings({ enableCommands: true });
    setPitService({ addFuel: true, fastRepair: true, cleanWindshield: false });

    await rootStore.pitServiceWidget.toggleFuel();
    await rootStore.pitServiceWidget.toggleFastRepair();
    await rootStore.pitServiceWidget.toggleWindshield();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearFuel', value: 0 }],
    });
    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearFastRepair', value: 0 }],
    });
    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'windshield', value: 0 }],
    });
  });

  it('keeps the per-checkbox commands behind the same opt-in', async () => {
    setFuelPlan(30, 106);
    setSettings({ enableCommands: false });

    await rootStore.pitServiceWidget.toggleFuel();
    await rootStore.pitServiceWidget.toggleTire('lf');
    await rootStore.pitServiceWidget.toggleFastRepair();

    expect(invokeMock).not.toHaveBeenCalledWith(
      'send_pit_order',
      expect.anything()
    );
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
    const enableAuto = () =>
      setSettings({
        enableCommands: true,
        autoService: true,
        autoFuel: true,
        autoTires: true,
        autoTireWearThreshold: 60,
      });

    it('orders only the corners worn past the threshold', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.55, rf: 0.62, lr: 0.9, rr: 0.6 });

      await rootStore.pitServiceWidget.applyAutoOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clear', value: 0 },
          { kind: 'fuel', value: 25 },
          { kind: 'lf', value: 0 },
          { kind: 'rr', value: 0 },
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

      await rootStore.pitServiceWidget.applyAutoOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clear', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    it('stands down for the rest of the stop after a manual change', async () => {
      setFuelPlan(30, 106);
      enableAuto();
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.toggleWindshield();

      expect(rootStore.pitServiceWidget.isAutoActive).toBe(false);

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoOrder();

      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );
    });

    it('takes over again on the next pit entry', async () => {
      enableAuto();
      rootStore.pitServiceWidget.suspendAuto();

      rootStore.pitServiceWidget.handlePitRoadChange(true);
      rootStore.pitServiceWidget.handlePitRoadChange(false);

      expect(rootStore.pitServiceWidget.isAutoActive).toBe(true);
    });

    it('stays out of the sim while commands are disabled', async () => {
      enableAuto();
      setSettings({ enableCommands: false });
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.applyAutoOrder();

      expect(rootStore.pitServiceWidget.isAutoEnabled).toBe(false);
      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );
    });
  });

  it('clears the whole order with a single command', async () => {
    setSettings({ enableCommands: true });

    await rootStore.pitServiceWidget.sendClearOrder();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clear', value: 0 }],
    });
  });
});
