import { observer } from 'mobx-react-lite';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { AppStatus } from '../AppStatus/AppStatus';
import { HeaderTrace } from './HeaderTrace';
import { WindowControls } from './WindowControls';
import Logo from '@assets/logo.svg?react';
import { useAppSettingsStore } from '@store/root-store-context';
import styles from './AppHeader.module.scss';

export type AppSection = 'layouts' | 'widgets' | 'settings';

interface AppHeaderProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
}

// Single unified header row: brand (left), section switcher (center), live
// status + version (right). An ambient telemetry waveform animates behind it.
export const AppHeader = observer(
  ({ activeSection, onSectionChange }: AppHeaderProps) => {
    const appSettings = useAppSettingsStore();
    const { t } = useTranslation('main-app');

    const sectionOptions = [
      { label: t('appHeader.sections.layouts'), value: 'layouts' },
      { label: t('appHeader.sections.widgets'), value: 'widgets' },
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
          <Segmented
            value={activeSection}
            onChange={(value) => onSectionChange(value as AppSection)}
            options={sectionOptions}
          />
        </div>

        <div className={styles.status} data-tauri-drag-region>
          <div className={styles.statusInfo} data-tauri-drag-region>
            <AppStatus />

            {appSettings.currentVersion && (
              <span className={styles.version}>
                v{appSettings.currentVersion}
              </span>
            )}
          </div>

          <WindowControls />
        </div>
      </header>
    );
  }
);
