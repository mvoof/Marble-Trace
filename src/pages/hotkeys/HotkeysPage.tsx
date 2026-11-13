import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { BindingsSettings } from './BindingsSettings';
import { DevicesSettings } from './DevicesSettings';
import styles from './HotkeysPage.module.scss';

/** Bindings and the devices they use; no inner menu, one under another. */
export const HotkeysPage = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('appHeader.sections.hotkeys')}</h1>
      </header>

      <div className={styles.stack}>
        <section className={styles.pane}>
          <h2 className={styles.paneTitle}>{t('bindings.title')}</h2>

          <BindingsSettings />
        </section>

        <section className={styles.pane}>
          <h2 className={styles.paneTitle}>{t('bindings.devicesTitle')}</h2>

          <DevicesSettings />
        </section>
      </div>
    </div>
  );
});
