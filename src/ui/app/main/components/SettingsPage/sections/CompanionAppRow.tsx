import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Switch, Tag, Tooltip } from 'antd';
import { AppWindow, Play, Square, Trash2 } from 'lucide-react';

import { useCompanionAppsStore } from '@store/root-store-context';
import type { CompanionApp } from '@/types/bindings';
import styles from './CompanionAppRow.module.scss';

const ICON_SIZE = 14;

interface CompanionAppRowProps {
  app: CompanionApp;
}

/**
 * One configured program: what it is, whether it is running, and the two
 * switches that decide what the overlay does about that on the way in and out.
 */
export const CompanionAppRow = observer(({ app }: CompanionAppRowProps) => {
  const companions = useCompanionAppsStore();
  const { t } = useTranslation('main-app');

  useEffect(() => {
    void companions.loadIcon(app.path);
  }, [companions, app.path]);

  const status = companions.statusOf(app.id);
  const icon = companions.icons[app.path];
  const busy = companions.busyId === app.id;

  return (
    <div className={styles.row}>
      {icon ? (
        <img className={styles.icon} src={icon} alt="" />
      ) : (
        <div className={`${styles.icon} ${styles.iconFallback}`}>
          <AppWindow size={ICON_SIZE} />
        </div>
      )}

      <div className={styles.texts}>
        <div className={styles.name}>{app.name}</div>

        <Tooltip title={app.path}>
          <div className={styles.path}>{app.path}</div>
        </Tooltip>
      </div>

      {status && !status.exists && (
        <Tag color="red">{t('settingsPage.companions.missing')}</Tag>
      )}

      {status?.exists && status.running && (
        <Tag color="green">{t('settingsPage.companions.running')}</Tag>
      )}

      {status?.exists && !status.running && (
        <Tag>{t('settingsPage.companions.stopped')}</Tag>
      )}

      <div className={styles.toggles}>
        <label className={styles.toggle}>
          <Switch
            size="small"
            checked={app.launchWithApp}
            onChange={(checked) =>
              companions.update(app.id, { launchWithApp: checked })
            }
          />

          {t('settingsPage.companions.launchWithApp')}
        </label>

        <label className={styles.toggle}>
          <Switch
            size="small"
            checked={app.closeWithApp}
            onChange={(checked) =>
              companions.update(app.id, { closeWithApp: checked })
            }
          />

          {t('settingsPage.companions.closeWithApp')}
        </label>
      </div>

      <div className={styles.actions}>
        {status?.running ? (
          <Tooltip
            title={
              status.owned
                ? t('settingsPage.companions.close')
                : t('settingsPage.companions.notOurs')
            }
          >
            <Button
              size="small"
              icon={<Square size={ICON_SIZE} />}
              loading={busy}
              disabled={!status.owned}
              onClick={() => void companions.close(app.id)}
            />
          </Tooltip>
        ) : (
          <Tooltip title={t('settingsPage.companions.launch')}>
            <Button
              size="small"
              icon={<Play size={ICON_SIZE} />}
              loading={busy}
              disabled={status ? !status.exists : false}
              onClick={() => void companions.launch(app.id)}
            />
          </Tooltip>
        )}

        <Popconfirm
          title={t('settingsPage.companions.removeConfirm')}
          okText={t('layoutEditor.delete')}
          okButtonProps={{ danger: true }}
          onConfirm={() => companions.remove(app.id)}
        >
          <Button size="small" danger icon={<Trash2 size={ICON_SIZE} />} />
        </Popconfirm>
      </div>
    </div>
  );
});
