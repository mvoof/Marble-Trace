import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import styles from './WidgetList.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

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

    const handleToggle = (checked: boolean) => {
      widgetSettings.setWidgetEnabled(widget.id, checked);
    };

    return (
      <div
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
        onClick={() => onSelect(widget.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onSelect(widget.id);
          }
        }}
      >
        <div className={styles.content}>
          <span className={styles.title}>{widget.label}</span>
          <span className={styles.description}>
            {widget.description || 'Configure widget settings.'}
          </span>
        </div>
        <div
          className={styles.switch}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Switch
            checked={widget.userSettings.enabled}
            size="small"
            onChange={handleToggle}
          />
        </div>
      </div>
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
