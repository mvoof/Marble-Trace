import { useCallback } from 'react';

import { useBackendComputedStore } from '@entities/cars/computed-context';

import { targetSpeedColor } from './target-speed';

/** A widget's target-colour settings, the same three keys in every dash. */
export interface TargetSpeedColorSettings {
  showSpeedTargetColor: boolean;
  speedOnTargetColor: string;
  speedOverTargetColor: string;
}

/**
 * The colour of a speed against the lit corner target, for `LiveSpeed`'s
 * `colorOf`: `null` with the setting off or nowhere near a target. Called
 * inside the speed's reactive write, so the frame and the settings it reads
 * are followed there, and only while the setting is on.
 */
export const useTargetSpeedColor = (
  settings: TargetSpeedColorSettings
): ((speed: number) => string | null) => {
  const computed = useBackendComputedStore();

  return useCallback(
    (speed: number) => {
      if (!settings.showSpeedTargetColor) {
        return null;
      }

      const color = targetSpeedColor(speed, computed.cornerSpeeds, {
        onTarget: settings.speedOnTargetColor,
        over: settings.speedOverTargetColor,
      });

      return color === '' ? null : color;
    },
    [settings, computed]
  );
};
