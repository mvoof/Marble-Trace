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
    setSettings({ commandTires: 'none' });

    expect(rootStore.pitServiceWidget.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'fuel', value: 26 },
    ]);
  });

  it('puts the selected corners on the order at the garage pressure', () => {
    setFuelPlan(10, 106);
    setSettings({ commandTires: 'fronts' });

    expect(rootStore.pitServiceWidget.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'fuel', value: 10 },
      { kind: 'lf', value: 0 },
      { kind: 'rf', value: 0 },
    ]);
  });

  it('omits fuel entirely when none is needed', () => {
    setFuelPlan(null, 106);
    setSettings({ commandTires: 'all' });

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
    setSettings({ enableCommands: true, commandTires: 'none' });

    await rootStore.pitServiceWidget.sendPlannedOrder();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [
        { kind: 'clear', value: 0 },
        { kind: 'fuel', value: 30 },
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

  it('clears the whole order with a single command', async () => {
    setSettings({ enableCommands: true });

    await rootStore.pitServiceWidget.sendClearOrder();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clear', value: 0 }],
    });
  });
});
