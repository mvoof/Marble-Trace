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
    if (bundle.carDynamics) {
      onFrame?.();
      root.player.updateCarDynamics(bundle.carDynamics);
    }

    if (bundle.carIdx) root.cars.updateCarIdx(bundle.carIdx);
    if (bundle.carInputs) root.player.updateCarInputs(bundle.carInputs);
    if (bundle.carPositions) root.cars.updateCarPositions(bundle.carPositions);
    if (bundle.carStatus) root.player.updateCarStatus(bundle.carStatus);
    if (bundle.lapTiming) root.player.updateLapTiming(bundle.lapTiming);

    // Unconditional on purpose: an absent frame means the car is nowhere near
    // the pits, which the rail has to clear rather than keep showing. The frame
    // is unpacked into plain observables and arrives quantized, so a car
    // standing in its box assigns the same three numbers and wakes nobody.
    root.player.updatePitTarget(bundle.pitTarget ?? null);

    if (bundle.session) root.session.updateSession(bundle.session);

    if (bundle.environment) {
      root.environment.updateEnvironment(bundle.environment);
    }

    if (bundle.chassis) root.player.updateChassis(bundle.chassis);
    if (bundle.pitService) root.player.updatePitService(bundle.pitService);

    if (bundle.proximity)
      root.backendComputed.updateProximity(bundle.proximity);

    if (bundle.incidents)
      root.backendComputed.updateIncidents(bundle.incidents);
    if (bundle.relative) root.backendComputed.updateRelative(bundle.relative);
    if (bundle.fuel) root.backendComputed.updateFuel(bundle.fuel);
    if (bundle.driverEntries)
      root.backendComputed.updateDriverEntries(bundle.driverEntries);
    if (bundle.pitStops) root.backendComputed.updatePitStops(bundle.pitStops);
    if (bundle.lapDelta) root.backendComputed.updateLapDelta(bundle.lapDelta);
    if (bundle.lapLog) root.backendComputed.updateLapLog(bundle.lapLog);

    if (bundle.trackRecording) {
      root.trackMapWidget.updateRecordingStatus(
        bundle.trackRecording.isRecording,
        bundle.trackRecording.isWaitingForSf,
        bundle.trackRecording.progress,
        bundle.trackRecording.pitLaneRecording
      );
    }
  });
};
