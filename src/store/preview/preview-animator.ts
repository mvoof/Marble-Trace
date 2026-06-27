import type { RootStore } from '@store/root-store';

// Time-series widgets (input trace) build a rolling history from successive
// carInputs frames, which a single seeded frame can't provide. Instead of
// animating forever, replay a burst of synthetic frames once: each
// updateCarInputs is its own MobX action, so the widget's autorun fires per
// frame and fills its internal ring buffer, leaving a static-looking trace.
const HISTORY_SAMPLES = 360; // ~6 s at 60 Hz, covers the max history window

export const seedInputHistory = (store: RootStore): void => {
  const base = store.player.carInputs;

  if (!base) {
    return;
  }

  for (let index = 0; index < HISTORY_SAMPLES; index++) {
    const seconds = index / 60;

    store.player.updateCarInputs({
      ...base,
      throttle: Math.max(0, Math.sin(seconds * 1.4)) ** 0.6,
      brake: Math.max(0, -Math.sin(seconds * 1.4 + 0.7)) * 0.85,
      clutch: 1,
    });
  }

  // Leave a fixed steering angle so the steering wheel isn't centered/empty.
  const dynamics = store.player.carDynamics;

  if (dynamics) {
    store.player.updateCarDynamics({
      ...dynamics,
      steering_wheel_angle: 2.4,
    });
  }
};
