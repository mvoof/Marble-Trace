import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from 'antd';
import { Repeat } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useCarCatalogueStore } from '@entities/cars/car-catalogue-context';
import { autoSwitchTarget } from '@entities/layout/auto-switch-rules';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { useSimStore } from '@entities/sim/sim-context';
import { cx } from '@shared/lib/class-names';

import { useSituationLabel } from './use-situation-label';
import styles from './AutoSwitchButton.module.scss';

const ICON_SIZE = 16;

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
 * Puts layouts on screen by the situation in the sim, pressed or not. The
 * hint says how it picks and what it would put on now; each layout's own card
 * says which situations it is put on screen in.
 */
export const AutoSwitchButton = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const isEnabled = appSettings.appSettings.autoSwitchLayouts;

  const hint = (
    <div className={styles.hint}>
      <p className={styles.description}>
        {t('layoutList.autoSwitch.description')}
      </p>

      <NowLine />
    </div>
  );

  return (
    <Tooltip title={hint} placement="bottomRight">
      <Button
        className={cx(isEnabled && styles.enabled)}
        icon={<Repeat size={ICON_SIZE} />}
        aria-pressed={isEnabled}
        onClick={() => appSettings.update({ autoSwitchLayouts: !isEnabled })}
      >
        {t('layoutList.autoSwitch.title')}
      </Button>
    </Tooltip>
  );
});
