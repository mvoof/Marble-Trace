import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useCarCatalogueStore } from '@entities/cars/car-catalogue-context';
import { autoSwitchTarget } from '@entities/layout/auto-switch-rules';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { useSimStore } from '@entities/sim/sim-context';
import { cx } from '@shared/lib/class-names';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';

import { useSituationLabel } from './use-situation-label';
import styles from './AutoSwitchBlock.module.scss';

/**
 * Where the driver is now and the layout auto-switch puts on screen for it —
 * the same answer the switch acts on. Nothing while the sim is not connected.
 */
const NowLine = observer(() => {
  const appSettings = useAppSettingsStore();
  const catalogue = useCarCatalogueStore();
  const layouts = useLayoutsStore();
  const player = usePlayerStore();
  const session = useSessionStore();
  const sim = useSimStore();
  const situationLabel = useSituationLabel();
  const { t } = useTranslation('main-app');

  const target = autoSwitchTarget(layouts.autoSwitchRules, {
    isConnected: sim.isConnected,
    isOnTrack: player.isOnTrack,
    sessionType: session.currentSessionType,
    catalogue: catalogue.cars,
    playerCar: session.playerCar,
  });

  if (!target) {
    return null;
  }

  const layoutName =
    target.layoutId === null
      ? null
      : (layouts.layouts.find((layout) => layout.id === target.layoutId)
          ?.name ?? target.layoutId);

  return (
    <p
      className={cx(
        styles.nowLine,
        !appSettings.appSettings.autoSwitchLayouts && styles.nowLineOff
      )}
    >
      <span className={styles.nowLabel}>{t('layoutList.autoSwitch.now')}</span>

      {target.situation && (
        <span>
          {situationLabel(target.situation)}
          {' → '}
        </span>
      )}

      {layoutName === null ? (
        <span className={styles.noLayout}>
          {t('layoutList.autoSwitch.noLayout')}
        </span>
      ) : (
        <span className={styles.layoutName}>{layoutName}</span>
      )}
    </p>
  );
});

/**
 * The switch for putting layouts on screen by the situation in the sim, and
 * what it would put on now. Each layout's own card says which situations it is
 * put on screen in.
 */
export const AutoSwitchBlock = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const isEnabled = appSettings.appSettings.autoSwitchLayouts;

  return (
    <SettingsCard
      title={t('layoutList.autoSwitch.title')}
      extra={
        <label className={styles.masterSwitch}>
          <span>{t('layoutList.autoSwitch.enabled')}</span>
          <Switch
            size="small"
            checked={isEnabled}
            onChange={(checked) =>
              appSettings.update({ autoSwitchLayouts: checked })
            }
          />
        </label>
      }
    >
      <p className={styles.description}>
        {t('layoutList.autoSwitch.description')}
      </p>

      <NowLine />
    </SettingsCard>
  );
});
