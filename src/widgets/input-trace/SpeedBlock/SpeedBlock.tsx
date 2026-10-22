import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';

import { CornerSpeeds } from './CornerSpeeds';
import { SpeedGear } from './SpeedGear';

import styles from './SpeedBlock.module.scss';
import type { InputTraceSettings } from '../settings-schema';

/**
 * The corner speeds, and — with the wheel hidden, which takes the hub's speed
 * and gear with it — the car's own speed and gear beside them.
 */
export const SpeedBlock = observer(() => {
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  if (!settings.showSpeedBlock) {
    return null;
  }

  return (
    <div className={styles.root}>
      <CornerSpeeds />

      {!settings.showSteering && <SpeedGear />}
    </div>
  );
});
