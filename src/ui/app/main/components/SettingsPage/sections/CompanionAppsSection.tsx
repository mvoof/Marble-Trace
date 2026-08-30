import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Flex, Tooltip } from 'antd';
import { AppWindow, Plus, Search } from 'lucide-react';

import { useCompanionAppsStore } from '@store/root-store-context';
import { CompanionAppRow } from './CompanionAppRow';
import { SettingsCard } from '../SettingsCard';
import rowStyles from './CompanionAppRow.module.scss';
import styles from '../SettingsPage.module.scss';

const ICON_SIZE = 14;

/**
 * The other programs a sim rig needs running. Detection offers what is
 * installed, the list below is what the overlay actually starts and stops.
 */
export const CompanionAppsSection = observer(() => {
  const companions = useCompanionAppsStore();
  const { t } = useTranslation('main-app');

  // The process snapshot behind the status column is expensive, so it is polled
  // only while this section is the one on screen.
  useEffect(() => {
    companions.startPolling();

    // The scan is what makes the page useful on first open, so it runs on its
    // own — the button is for picking up something installed since.
    void companions.detect();

    return () => {
      companions.stopPolling();
    };
  }, [companions]);

  const detected = companions.undetectedOnly;

  return (
    <SettingsCard title={t('settingsPage.companions.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.companions.addTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {t('settingsPage.companions.addDesc')}
        </div>

        <Flex gap={8}>
          <Button
            className={styles.buttonFlex}
            size="small"
            icon={<Search size={ICON_SIZE} />}
            loading={companions.detecting}
            onClick={() => void companions.detect()}
          >
            {t('settingsPage.companions.detect')}
          </Button>

          <Button
            className={styles.buttonFlex}
            size="small"
            icon={<Plus size={ICON_SIZE} />}
            disabled={!companions.canAddMore}
            onClick={() => void companions.addByPicker()}
          >
            {t('settingsPage.companions.browse')}
          </Button>
        </Flex>
      </div>

      {/* Above the detected list on purpose: a program added from the picker
          lands here, and behind a list of a dozen found ones it would appear
          off screen — which reads as nothing having happened. */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.companions.listTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {t('settingsPage.companions.listDesc')}
        </div>

        {/* Where an elevated program reports back: Windows refuses to let an
            ordinary process close one, and the row alone cannot say why. */}
        {companions.lastError && (
          <div className={styles.statusError}>{companions.lastError}</div>
        )}

        {companions.apps.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('settingsPage.companions.empty')}
          />
        ) : (
          <div className={rowStyles.list}>
            {companions.apps.map((app) => (
              <CompanionAppRow key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>

      {detected.length > 0 && (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldTitle}>
            {t('settingsPage.companions.detectedTitle')}
          </div>

          <div
            className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
          >
            {t('settingsPage.companions.detectedDesc')}
          </div>

          <div className={rowStyles.list}>
            {detected.map((app) => (
              <div className={rowStyles.row} key={app.path}>
                {companions.icons[app.path] ? (
                  <img
                    className={rowStyles.icon}
                    src={companions.icons[app.path] ?? undefined}
                    alt=""
                  />
                ) : (
                  <div
                    className={`${rowStyles.icon} ${rowStyles.iconFallback}`}
                  >
                    <AppWindow size={ICON_SIZE} />
                  </div>
                )}

                <div className={rowStyles.texts}>
                  <div className={rowStyles.name}>{app.name}</div>

                  <Tooltip title={app.path}>
                    <div className={rowStyles.path}>{app.path}</div>
                  </Tooltip>
                </div>

                <Button
                  size="small"
                  icon={<Plus size={ICON_SIZE} />}
                  disabled={!companions.canAddMore}
                  onClick={() => companions.add(app)}
                >
                  {t('settingsPage.companions.add')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsCard>
  );
});
