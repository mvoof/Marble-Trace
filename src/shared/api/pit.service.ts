import { invoke } from '@tauri-apps/api/core';

import type { PitAction, PitAutoConfig } from '@shared/contracts/bindings';

/**
 * A manual change to the pit order. The telemetry thread works out the
 * broadcasts against the order the sim reports and sends them; the result
 * comes back on `pitAuto.ordersSent`.
 */
export const runPitAction = async (action: PitAction): Promise<void> =>
  invoke('run_pit_action', { action });

/** The auto mode plate: hands the stop to the driver, or back to auto mode. */
export const togglePitAuto = async (): Promise<void> =>
  invoke('toggle_pit_auto');

export const setPitStrategySilent = (strategy: PitAutoConfig): void => {
  invoke('set_pit_strategy', { strategy }).catch((error) =>
    console.error('[pit.service] set_pit_strategy failed:', error)
  );
};
