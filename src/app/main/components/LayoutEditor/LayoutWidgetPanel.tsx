import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { Switch, Button } from 'antd';
import { Settings2, ArrowLeft } from 'lucide-react';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { useWidgetSettingsStore } from '@store/root-store-context';
import styles from './LayoutWidgetPanel.module.scss';

interface LayoutWidgetPanelProps {
  selectedWidgetId: string | null;
  editingWidgetId: string | null;
  onSelectWidget: (id: string) => void;
  onEditWidget: (id: string | null) => void;
}

const WidgetRow = observer(
  ({
    widget,
    isSelected,
    onSelectWidget,
    onEditWidget,
  }: {
    widget: WidgetDefaultConfig;
    isSelected: boolean;
    onSelectWidget: (id: string) => void;
    onEditWidget: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const isAvailable = widgetSettings.availableWidgetIds.includes(widget.id);
    const rowRef = useRef<HTMLDivElement>(null);

    const handleToggle = (checked: boolean) => {
      if (isAvailable) {
        widgetSettings.setWidgetEnabled(widget.id, checked);
      }
    };

    useEffect(() => {
      if (isSelected) {
        rowRef.current?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }, [isSelected]);

    return (
      <div
        ref={rowRef}
        className={`${styles.row} ${isSelected ? styles.selected : ''} ${
          !isAvailable ? styles.disabled : ''
        }`}
      >
        <Switch
          size="small"
          checked={widget.userSettings.enabled && isAvailable}
          disabled={!isAvailable}
          onChange={handleToggle}
        />

        <button
          type="button"
          className={styles.label}
          onClick={() => onSelectWidget(widget.id)}
        >
          {widget.label}
        </button>

        <Button
          size="small"
          type="text"
          icon={<Settings2 size={14} />}
          onClick={() => onEditWidget(widget.id)}
        />
      </div>
    );
  }
);

// Master-detail widget panel for the layout editor. The list shows every widget
// (presence toggle = visibility in the active layout). Clicking the gear opens
// that widget's settings inline with a back affordance, keeping the canvas live.
export const LayoutWidgetPanel = observer(
  ({
    selectedWidgetId,
    editingWidgetId,
    onSelectWidget,
    onEditWidget,
  }: LayoutWidgetPanelProps) => {
    const widgetSettings = useWidgetSettingsStore();

    if (editingWidgetId) {
      return (
        <div className={styles.detail}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={14} />}
            className={styles.backButton}
            onClick={() => onEditWidget(null)}
          >
            Back
          </Button>

          <div className={styles.detailBody}>
            <WidgetSettings widgetId={editingWidgetId} />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.list}>
        {widgetSettings.allWidgets.map((widget) => (
          <WidgetRow
            key={widget.id}
            widget={widget}
            isSelected={selectedWidgetId === widget.id}
            onSelectWidget={onSelectWidget}
            onEditWidget={onEditWidget}
          />
        ))}
      </div>
    );
  }
);
