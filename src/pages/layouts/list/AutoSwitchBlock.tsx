import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Select, Switch } from 'antd';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import type { SessionContext } from '@shared/contracts/widget-settings';

import { SESSION_CONTEXTS, SESSION_LOOKS } from './session-labels';
import styles from './AutoSwitchBlock.module.scss';

const NO_LAYOUT = '';

/**
 * Which layout goes on screen in each situation in the sim, and the switch for
 * the whole thing. The one place a layout is assigned. Each situation is a rule
 * row; rows by car class and car join the same list later.
 */
export const AutoSwitchBlock = observer(() => {
  const layouts = useLayoutsStore();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const isEnabled = appSettings.appSettings.autoSwitchLayouts;

  const layoutOptions = [
    { value: NO_LAYOUT, label: t('layoutList.autoSwitch.noLayout') },
    ...layouts.layouts.map((layout) => ({
      value: layout.id,
      label: layout.name,
    })),
  ];

  const handleChange = (context: SessionContext, value: string) => {
    layouts.setSessionLayout(context, value === NO_LAYOUT ? null : value);
  };

  return (
    <section className={styles.block}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('layoutList.autoSwitch.title')}</h2>
          <p className={styles.description}>
            {t('layoutList.autoSwitch.description')}
          </p>
        </div>

        <label className={styles.masterSwitch}>
          <span>{t('layoutList.autoSwitch.enabled')}</span>
          <Switch
            checked={isEnabled}
            onChange={(checked) =>
              appSettings.update({ autoSwitchLayouts: checked })
            }
          />
        </label>
      </header>

      <div className={styles.rules}>
        {SESSION_CONTEXTS.map((context) => {
          const { labelKey, icon: SessionIcon } = SESSION_LOOKS[context];

          return (
            <div key={context} className={styles.rule}>
              <span className={styles.situation}>
                <SessionIcon size={16} />
                {t(labelKey)}
              </span>

              <Select
                className={styles.layoutSelect}
                value={layouts.sessionLayouts[context] ?? NO_LAYOUT}
                options={layoutOptions}
                onChange={(value: string) => handleChange(context, value)}
                aria-label={t(labelKey)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
});
