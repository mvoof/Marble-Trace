import { runInAction } from 'mobx';

import type { TelemetryBundle } from '@/types/bindings';
import type { RootStore } from '@store/root-store';

/**
 * Scatters one bundle across the data stores.
 *
 * Extracted from `SimStore` because a remote screen receives the very same
 * bundle over a WebSocket instead of a Tauri event: the transport differs, the
 * mapping must not. Every field a widget reads is filled here and nowhere else.
 */
export const applyTelemetryBundle = (
  root: RootStore,
  bundle: TelemetryBundle,
  onFrame?: () => void
) => {
  runInAction(() => {
    if (bundle.car_dynamics) {
      onFrame?.();
      root.player.updateCarDynamics(bundle.car_dynamics);
    }

    if (bundle.car_idx) root.cars.updateCarIdx(bundle.car_idx);
    if (bundle.car_inputs) root.player.updateCarInputs(bundle.car_inputs);
    if (bundle.car_positions)
      root.cars.updateCarPositions(bundle.car_positions);
    if (bundle.car_status) root.player.updateCarStatus(bundle.car_status);
    if (bundle.lap_timing) root.player.updateLapTiming(bundle.lap_timing);

    root.player.updatePitTarget(
      bundle.pit_target_dist_m ?? null,
      bundle.pit_target_type ?? null,
      bundle.pit_lane_progress_pct ?? null
    );

    if (bundle.session) root.session.updateSession(bundle.session);

    if (bundle.environment) {
      root.environment.updateEnvironment(bundle.environment);
    }

    if (bundle.chassis) root.player.updateChassis(bundle.chassis);
    if (bundle.pit_service) root.player.updatePitService(bundle.pit_service);

    if (bundle.proximity)
      root.backendComputed.updateProximity(bundle.proximity);
    if (bundle.relative) root.backendComputed.updateRelative(bundle.relative);
    if (bundle.fuel) root.backendComputed.updateFuel(bundle.fuel);
    if (bundle.driver_entries)
      root.backendComputed.updateDriverEntries(bundle.driver_entries);
    if (bundle.pit_stops) root.backendComputed.updatePitStops(bundle.pit_stops);
    if (bundle.lap_delta) root.backendComputed.updateLapDelta(bundle.lap_delta);
    if (bundle.lap_log) root.backendComputed.updateLapLog(bundle.lap_log);

    if (bundle.track_recording) {
      root.trackMapWidget.updateRecordingStatus(
        bundle.track_recording.isRecording,
        bundle.track_recording.isWaitingForSf,
        bundle.track_recording.progress,
        bundle.track_recording.pitLaneRecording
      );
    }
  });
};
