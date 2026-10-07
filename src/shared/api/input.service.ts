import { invoke } from '@tauri-apps/api/core';

import type {
  InputDevice,
  InputDeviceResolution,
} from '@shared/contracts/bindings';

export const resolveInputDevices = async (
  known: InputDevice[]
): Promise<InputDeviceResolution> => invoke('resolve_input_devices', { known });

export const setInputPollingEnabled = async (enabled: boolean): Promise<void> =>
  invoke('set_input_polling_enabled', { enabled });
