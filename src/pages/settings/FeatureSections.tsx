import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SECTION_COMPONENTS } from './section-components';
import { FEATURE_PAGE_SECTIONS, type FeaturePage } from './settings-sections';
import styles from './SettingsPage.module.scss';

type FeatureSectionsProps = { page: FeaturePage };

/** A feature page: its sections, one under another. */
export const FeatureSections = observer(({ page }: FeatureSectionsProps) => {
  const { t } = useTranslation('main-app');

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>{t(`appHeader.sections.${page}`)}</h1>
      </header>

      <div className={styles.stack}>
        {FEATURE_PAGE_SECTIONS[page].map((sectionId) => {
          const Section = SECTION_COMPONENTS[sectionId];

          return (
            <section key={sectionId} className={styles.pane}>
              <h2 className={styles.paneTitle}>
                {t(`settingsPage.nav.sections.${sectionId}`)}
              </h2>

              <Section />
            </section>
          );
        })}
      </div>
    </div>
  );
});
