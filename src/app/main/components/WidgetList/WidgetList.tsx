import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import { useWidgetSettingsStore } from '@store/root-store-context';
import styles from './WidgetList.module.scss';

const WidgetListItem = observer(
  ({
    widget,
    isActive,
    onSelect,
  }: {
    widget: WidgetDefaultConfig;
    isActive: boolean;
    onSelect: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');

    const isAvailable = widgetSettings.availableWidgetIds.includes(widget.id);

    return (
      <button
        type="button"
        aria-label={widget.label}
        className={`${styles.listItem} ${isActive ? styles.active : ''} ${
          !isAvailable ? styles.disabled : ''
        }`}
        onClick={() => {
          if (isAvailable) {
            onSelect(widget.id);
          }
        }}
        disabled={!isAvailable}
      >
        <div className={styles.content}>
          <div className={styles.headerRow}>
            <span className={styles.title}>{widget.label}</span>
            {!isAvailable && (
              <span className={styles.unavailable}>
                {t('widgetList.unavailable')}
              </span>
            )}
          </div>
          <span className={styles.description}>
            {widget.description || t('widgetList.defaultDescription')}
          </span>
        </div>
      </button>
    );
  }
);

export const WidgetList = observer(
  ({
    selectedId,
    onSelect,
  }: {
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();

    return (
      <div className={styles.list}>
        {widgetSettings.allWidgets.map((widget) => (
          <WidgetListItem
            key={widget.id}
            widget={widget}
            isActive={selectedId === widget.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }
);
