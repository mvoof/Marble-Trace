import type { LapDeltaReference } from '@/types/widget-settings';

export const DELTA_REFERENCE_DESC: Record<LapDeltaReference, string> = {
  personal_best: 'Your best clean lap this session.',
  personal_optimal:
    'Your theoretical best — fastest sector from each of your laps combined.',
  session_best: 'Fastest lap set by any driver in the current session.',
  session_optimal:
    'Theoretical best — fastest sector from any driver in the session combined.',
  session_last: 'Last fully completed lap by any driver in the session.',
};
