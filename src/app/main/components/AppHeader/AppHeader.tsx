import { observer } from 'mobx-react-lite';
import { Segmented } from 'antd';
import { AppStatus } from '../AppStatus/AppStatus';
import { HeaderTrace } from './HeaderTrace';
import { WindowControls } from './WindowControls';
import Logo from '@assets/logo.svg?react';
import { useAppSettingsStore } from '@store/root-store-context';
import styles from './AppHeader.module.scss';

export type AppSection = 'layouts' | 'widgets' | 'settings';

const SECTION_OPTIONS = [
  { label: 'Layouts', value: 'layouts' },
  { label: 'Widgets', value: 'widgets' },
  { label: 'Settings', value: 'settings' },
];

interface AppHeaderProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
}

// Single unified header row: brand (left), section switcher (center), live
// status + version (right). An ambient telemetry waveform animates behind it.
export const AppHeader = observer(
  ({ activeSection, onSectionChange }: AppHeaderProps) => {
    const appSettings = useAppSettingsStore();

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
            options={SECTION_OPTIONS}
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
