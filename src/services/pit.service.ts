import { invoke } from '@tauri-apps/api/core';

import type { PitCommandRequest } from '@/types/bindings';

export const sendPitOrder = async (
  requests: PitCommandRequest[]
): Promise<void> => invoke('send_pit_order', { requests });
