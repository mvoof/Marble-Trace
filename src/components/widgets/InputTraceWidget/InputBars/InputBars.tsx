import { useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import {
  ProgressBar,
  type ProgressBarHandle,
} from '../../../shared/primitives/ProgressBar/ProgressBar';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';

import styles from './InputBars.module.scss';

export interface InputBarsHandle {
  update: (throttle: number, brake: number, clutch: number) => void;
}

interface InputBarsProps {
  throttle: number;
  brake: number;
  clutch: number;
  settings: ReturnType<typeof widgetSettingsStore.getInputTraceSettings>;
  isVertical: boolean;
  ref?: Ref<InputBarsHandle>;
}

export const InputBars = ({
  throttle,
  brake,
  clutch,
  settings,
  isVertical,
  ref,
}: InputBarsProps) => {
  const throttleRef = useRef<ProgressBarHandle>(null);
  const brakeRef = useRef<ProgressBarHandle>(null);
  const clutchRef = useRef<ProgressBarHandle>(null);

  useImperativeHandle(ref, () => ({
    update: (t, b, c) => {
      throttleRef.current?.update(t);
      brakeRef.current?.update(b);
      clutchRef.current?.update(c);
    },
  }));

  if (isVertical) {
    return (
      <div className={styles.barsVertical}>
        {settings.showClutch && (
          <ProgressBar
            ref={clutchRef}
            value={clutch}
            color={settings.clutchColor}
            height="lg"
            vertical
            rounded={false}
          />
        )}

        {settings.showBrake && (
          <ProgressBar
            ref={brakeRef}
            value={brake}
            color={settings.brakeColor}
            height="lg"
            vertical
            rounded={false}
          />
        )}

        {settings.showThrottle && (
          <ProgressBar
            ref={throttleRef}
            value={throttle}
            color={settings.throttleColor}
            height="lg"
            vertical
            rounded={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.barsHorizontal}>
      {settings.showThrottle && (
        <ProgressBar
          ref={throttleRef}
          value={throttle}
          color={settings.throttleColor}
          height="lg"
          rounded={false}
        />
      )}

      {settings.showBrake && (
        <ProgressBar
          ref={brakeRef}
          value={brake}
          color={settings.brakeColor}
          height="lg"
          rounded={false}
        />
      )}

      {settings.showClutch && (
        <ProgressBar
          ref={clutchRef}
          value={clutch}
          color={settings.clutchColor}
          height="lg"
          rounded={false}
        />
      )}
    </div>
  );
};
