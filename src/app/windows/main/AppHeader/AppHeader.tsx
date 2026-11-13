import { observer } from 'mobx-react-lite';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import type { MainSection } from '@features/main-navigation/main-navigation.store';
import { AppStatus } from '../AppStatus/AppStatus';
import { HeaderTrace } from './HeaderTrace';
import { WindowControls } from './WindowControls';
import Logo from '@assets/brand-mark.svg?react';
import styles from './AppHeader.module.scss';

// Single unified header row: brand (left), section switcher (center), live
// status (right). An ambient telemetry waveform animates behind it.
export const AppHeader = observer(() => {
  const navigation = useMainNavigationStore();
  const { t } = useTranslation('main-app');

  const sectionOptions: { label: string; value: MainSection }[] = [
    { label: t('appHeader.sections.layouts'), value: 'layouts' },
    { label: t('appHeader.sections.widgets'), value: 'widgets' },
    { label: t('appHeader.sections.crew'), value: 'crew' },
    { label: t('appHeader.sections.settings'), value: 'settings' },
  ];

  return (
    <header className={styles.header} data-tauri-drag-region>
      <HeaderTrace />

      <div className={styles.brand} data-tauri-drag-region>
        <Logo className={styles.logo} />
        <span className={styles.name}>Marble Trace</span>
      </div>

      <div className={styles.nav}>
        <Segmented<MainSection>
          value={navigation.section}
          onChange={(section) => navigation.open(section)}
          options={sectionOptions}
        />
      </div>

      <div className={styles.status} data-tauri-drag-region>
        <div className={styles.statusInfo} data-tauri-drag-region>
          <AppStatus />
        </div>

        <WindowControls />
      </div>
    </header>
  );
});
