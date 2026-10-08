import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Select, Switch, Tooltip } from 'antd';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  BringToFront,
  Copy,
  Maximize2,
  RotateCcw,
  SendToBack,
} from 'lucide-react';

import { getWidgetLabel } from '@entities/widget/widget-i18n';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { Card, PanelWidgetProvider } from '@features/widget-settings/Card';
import { SettingRow } from '@features/widget-settings/SettingRow';
import type { SnapPosition } from '@features/layout-editor/snap-position';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import styles from './WidgetInspector.module.scss';

const ICON_SIZE = 14;

// The fold-state key the inspector's action card is remembered under.
const EDITOR_ACTIONS_GROUP = 'layout-editor';

interface WidgetInspectorProps {
  selectedWidgetId: string | null;
  isRatioLocked: boolean;
  onToggleRatioLock: () => void;
  moveTargetOptions: { value: string; label: string }[];
  /** Selection follows what the tools do — a copy becomes the selection, a
   *  deleted copy leaves none. */
  onSelectWidget: (widgetId: string | null) => void;
  onSnap: (position: SnapPosition) => void;
}

const SNAP_BUTTONS: { position: SnapPosition; Icon: typeof ArrowUpLeft }[] = [
  { position: 'topLeft', Icon: ArrowUpLeft },
  { position: 'topCenter', Icon: ArrowUp },
  { position: 'topRight', Icon: ArrowUpRight },
  { position: 'midLeft', Icon: ArrowLeft },
  { position: 'center', Icon: Maximize2 },
  { position: 'midRight', Icon: ArrowRight },
  { position: 'bottomLeft', Icon: ArrowDownLeft },
  { position: 'bottomCenter', Icon: ArrowDown },
  { position: 'bottomRight', Icon: ArrowDownRight },
];

/**
 * Everything about the selected widget, in one column beside the canvas: what
 * the editor does to it, then its own settings.
 *
 * Where the editors people already know put it, and for the reasons they do —
 * the tools never cover the thing being edited, they have room for words
 * instead of a wall of icons, and there is one place to look for "where do I
 * change this" rather than two.
 *
 * The column keeps its width whether or not anything is selected, so the canvas
 * does not reflow and rescale on every click.
 */
export const WidgetInspector = observer(
  ({
    selectedWidgetId,
    isRatioLocked,
    onToggleRatioLock,
    moveTargetOptions,
    onSelectWidget,
    onSnap,
  }: WidgetInspectorProps) => {
    const liveWidgets = useMainLiveWidgetsStore();
    const { t } = useTranslation('main-app');

    const widget = selectedWidgetId
      ? liveWidgets.getWidget(selectedWidgetId)
      : undefined;

    if (!selectedWidgetId || !widget) {
      return (
        <div className={styles.empty}>
          {t('widgetSettings.selectToConfigure')}
        </div>
      );
    }

    const { ordinal, total } = liveWidgets.copyOrdinalOf(widget.id);
    const isCopy = ordinal > 1;

    // Never the monitor it already stands on.
    const moveTargets = moveTargetOptions.filter(
      (option) => option.value !== widget.monitor
    );

    const settingsSources = liveWidgets
      .settingsSourcesFor(widget.id)
      .map((source) => {
        const place = liveWidgets.copyOrdinalOf(source.id);

        return {
          value: source.id,
          label: `${source.monitor ?? '—'} · ${place.ordinal}/${place.total}`,
        };
      });

    return (
      <div className={styles.root}>
        <header className={styles.header}>
          <span className={styles.name}>{getWidgetLabel(t, widget)}</span>

          {total > 1 && (
            <Tooltip
              title={
                isCopy
                  ? t('layoutWidgetPanel.copyTooltip')
                  : t('layoutWidgetPanel.originalTooltip')
              }
            >
              <span className={styles.copyTag}>
                {isCopy && <Copy size={10} />}
                {ordinal}/{total}
              </span>
            </Tooltip>
          )}
        </header>

        <div className={styles.body}>
          {/* One fold for the whole editor, not per widget: folded once, the
              actions stay out of the way whichever widget is selected next. */}
          <PanelWidgetProvider widgetId={EDITOR_ACTIONS_GROUP}>
            <Card title={t('layoutEditor.inspectorActions')} defaultOpen>
              <SettingRow stacked title={t('layoutEditor.lockAspectRatio')}>
                <Switch
                  size="small"
                  checked={isRatioLocked}
                  onChange={onToggleRatioLock}
                />
              </SettingRow>

              <SettingRow
                stacked
                title={t('layoutEditor.hotkeysActOn')}
                desc={t('layoutEditor.hotkeysActOnDesc')}
              >
                <Switch
                  size="small"
                  checked={liveWidgets.hotkeysActOnWidget(widget.id)}
                  onChange={(checked) =>
                    liveWidgets.setHotkeysActOn(widget.id, checked)
                  }
                />
              </SettingRow>

              {moveTargets.length > 0 && (
                <SettingRow stacked title={t('layoutEditor.moveToMonitor')}>
                  <Select
                    size="small"
                    value={null}
                    placeholder={t('layoutEditor.moveToMonitorPlaceholder')}
                    onChange={(monitorName: string) =>
                      liveWidgets.moveWidgetToMonitor(widget.id, monitorName)
                    }
                    options={moveTargets}
                    popupMatchSelectWidth={200}
                    className={styles.moveSelect}
                  />
                </SettingRow>
              )}

              {settingsSources.length > 0 && (
                <SettingRow
                  stacked
                  title={t('layoutEditor.copySettingsFrom')}
                  desc={t('layoutEditor.copySettingsFromDesc')}
                >
                  <Select
                    size="small"
                    value={null}
                    placeholder={t('layoutEditor.copySettingsFromPlaceholder')}
                    onChange={(sourceId: string) =>
                      liveWidgets.copySettingsFrom(widget.id, sourceId)
                    }
                    options={settingsSources}
                    popupMatchSelectWidth={200}
                    className={styles.moveSelect}
                  />
                </SettingRow>
              )}

              <SettingRow stacked title={t('layoutEditor.resetSettings')}>
                <Popconfirm
                  title={t('layoutEditor.resetSettingsConfirm')}
                  okText={t('layoutEditor.resetSettingsOk')}
                  cancelText={t('layoutEditor.cancel')}
                  onConfirm={() => liveWidgets.resetSettings(widget.id)}
                >
                  <Button size="small" icon={<RotateCcw size={ICON_SIZE} />}>
                    {t('layoutEditor.reset')}
                  </Button>
                </Popconfirm>
              </SettingRow>

              <SettingRow stacked title={t('layoutEditor.layerOrder')}>
                <div className={styles.buttonPair}>
                  <Tooltip title={t('layoutEditor.bringToFront')}>
                    <Button
                      size="small"
                      icon={<BringToFront size={ICON_SIZE} />}
                      onClick={() => liveWidgets.bringToFront(widget.id)}
                    />
                  </Tooltip>

                  <Tooltip title={t('layoutEditor.sendToBack')}>
                    <Button
                      size="small"
                      icon={<SendToBack size={ICON_SIZE} />}
                      onClick={() => liveWidgets.sendToBack(widget.id)}
                    />
                  </Tooltip>
                </div>
              </SettingRow>

              <SettingRow stacked title={t('layoutEditor.duplicateWidget')}>
                <Button
                  size="small"
                  icon={<Copy size={ICON_SIZE} />}
                  onClick={() => {
                    const copyId = liveWidgets.duplicateWidget(widget.id);

                    // Selection follows the copy: it is offset from the widget it
                    // came from and on top, so it is the one about to be placed.
                    if (copyId !== null) {
                      onSelectWidget(copyId);
                    }
                  }}
                >
                  {t('layoutEditor.duplicate')}
                </Button>
              </SettingRow>

              <SettingRow
                stacked
                title={t('layoutEditor.quickPlacement')}
                desc={t('layoutEditor.quickPlacementDesc')}
              >
                <div className={styles.snapGrid}>
                  {SNAP_BUTTONS.map(({ position, Icon }) => (
                    <Button
                      key={position}
                      size="small"
                      type="text"
                      icon={<Icon size={ICON_SIZE} />}
                      onClick={() => onSnap(position)}
                    />
                  ))}
                </div>
              </SettingRow>
            </Card>
          </PanelWidgetProvider>

          <WidgetSettings widgetId={selectedWidgetId} hideHeader />
        </div>
      </div>
    );
  }
);
