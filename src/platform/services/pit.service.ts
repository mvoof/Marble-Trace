import { invoke } from '@tauri-apps/api/core';

import type {
  PitAutoConfig,
  PitClaim,
  PitCommandRequest,
} from '@/types/bindings';

/**
 * A manual order. `claim` names the halves of the stop it takes away from auto
 * mode, which decides on the telemetry thread.
 */
export const sendPitOrder = async (
  requests: PitCommandRequest[],
  claim?: PitClaim
): Promise<void> =>
  invoke('send_pit_order', { requests, claim: claim ?? null });

/** The auto mode key: hands the stop to the driver, or back to auto mode. */
export const togglePitAuto = async (): Promise<void> =>
  invoke('toggle_pit_auto');

export const setPitStrategySilent = (strategy: PitAutoConfig): void => {
  invoke('set_pit_strategy', { strategy }).catch((error) =>
    console.error('[pit.service] set_pit_strategy failed:', error)
  );
};
