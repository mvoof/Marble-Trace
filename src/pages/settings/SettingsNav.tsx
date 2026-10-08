import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { SETTINGS_GROUPS, type SettingsSectionId } from './settings-sections';
import styles from './SettingsPage.module.scss';

interface SettingsNavProps {
  active: SettingsSectionId;
  openGroups: string[];
  onSelect: (section: SettingsSectionId) => void;
  onToggleGroup: (groupId: string) => void;
}

export const SettingsNav = observer(
  ({ active, openGroups, onSelect, onToggleGroup }: SettingsNavProps) => {
    const { t } = useTranslation('main-app');

    return (
      <nav className={styles.nav}>
        {SETTINGS_GROUPS.map((group) => {
          const isOpen = openGroups.includes(group.id);

          return (
            <div key={group.id} className={styles.navGroup}>
              <button
                type="button"
                className={styles.navGroupHeader}
                aria-expanded={isOpen}
                onClick={() => onToggleGroup(group.id)}
              >
                <span>{t(`settingsPage.nav.groups.${group.id}`)}</span>

                <ChevronDown
                  size={14}
                  className={isOpen ? styles.navChevronOpen : styles.navChevron}
                />
              </button>

              {isOpen && (
                <div className={styles.navItems}>
                  {group.sections.map((section) => (
                    <button
                      key={section}
                      type="button"
                      className={
                        section === active
                          ? styles.navItemActive
                          : styles.navItem
                      }
                      onClick={() => onSelect(section)}
                    >
                      {t(`settingsPage.nav.sections.${section}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    );
  }
);
