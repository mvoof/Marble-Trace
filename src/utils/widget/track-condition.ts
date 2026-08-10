import type { TrackCondition } from '@/types/bindings';

/**
 * Track wetness (0=dry to 7=flooded) at or above which the track counts as wet.
 *
 * Must stay in step with `WET_THRESHOLD` in `model/reference_lap.rs` — the
 * backend files a reference lap by this boundary and the frontend asks for one
 * by it, so a disagreement means asking for a file that was never written.
 */
const WET_THRESHOLD = 3;

/**
 * Classifies a wetness reading into the condition a reference lap is stored
 * under. An absent reading means the sim does not model wetness for this
 * session, which is the dry case.
 */
export const trackConditionForWetness = (
  trackWetness: number | null
): TrackCondition =>
  trackWetness !== null && trackWetness >= WET_THRESHOLD ? 'wet' : 'dry';
