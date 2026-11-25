import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useUnitsStore } from '@entities/app-settings/units-context';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { cx } from '@shared/lib/class-names';
import { formatSpeed, speedUnit } from '@shared/lib/telemetry-format';
import { useLiveParts, writeState } from '@shared/ui/live/live-parts';
import { useRelativeWidgetStore } from '../relative.store';
import styles from './CarSpeed.module.scss';

interface CarSpeedProps {
  carIdx: number;
  showUnits: boolean;
  isPaceCar?: boolean;
  className?: string;
}

export const CarSpeed = observer(
  ({ carIdx, showUnits, isPaceCar = false, className }: CarSpeedProps) => {
    const computed = useBackendComputedStore();
    const relative = useRelativeWidgetStore();
    const units = useUnitsStore();
    const { t } = useTranslation('widgets');
    const unitSystem = units.unitSystem;
    const parts = useLiveParts<'value'>();

    const cellRef = useReactiveDomWrite<HTMLDivElement>(
      (element, scheduleWrite) => {
        const speed = isPaceCar
          ? relative.paceCarRowOf(carIdx)?.speed
          : computed.relativeEntryOf(carIdx)?.speed;
        const available = speed != null && Number.isFinite(speed) && speed >= 0;
        // A synthetic pace-car row may have no speed. Leave its cell blank.
        const value = available
          ? formatSpeed(speed, unitSystem)
          : isPaceCar
            ? ''
            : '–';

        scheduleWrite(() => {
          parts.text('value', value);
          writeState(element, 'available', available ? 'true' : 'false');
        });
      },
      [computed, relative, carIdx, isPaceCar, unitSystem, parts]
    );

    return (
      <div ref={cellRef} className={cx(styles.cell, className)}>
        <span ref={parts.ref('value')} className={styles.value} />
        {showUnits && (
          <span className={styles.unit}>
            {unitSystem === 'metric'
              ? t('settingsPanels.relative.metricSpeedUnit')
              : speedUnit(unitSystem).toLowerCase()}
          </span>
        )}
      </div>
    );
  }
);
