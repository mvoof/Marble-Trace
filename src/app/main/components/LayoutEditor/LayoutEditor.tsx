import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, InputNumber, Popconfirm, Select, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Image,
  ImageOff,
  Grid3x3,
  Magnet,
  Maximize,
  Minimize,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import {
  useAppSettingsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { LayoutCanvas } from './LayoutCanvas';
import { LayoutWidgetPanel } from './LayoutWidgetPanel';
import {
  saveBackgroundImage,
  deleteBackgroundImage,
} from '@utils/widget/layout-background';
import styles from './LayoutEditor.module.scss';

const SCENARIO_OPTIONS = PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

const GRID_SIZE_OPTIONS = [10, 15, 20, 30, 40].map((size) => ({
  value: size,
  label: `${size}px`,
}));

// Layout editor section: a WYSIWYG canvas of the active layout plus a
// master-detail widget panel. Editing the canvas (drag/resize) or a widget's
// settings auto-commits into the active layout via the store's change reaction.
export const LayoutEditor = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const appSettings = useAppSettingsStore();

  const showGrid = appSettings.appSettings.editorShowGrid;
  const snapToGrid = appSettings.appSettings.editorSnapToGrid;
  const gridSize = appSettings.appSettings.editorGridSize;

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef<InputRef | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const activeId = widgetSettings.activeLayoutId;
  const activeLayout = widgetSettings.activeLayout;

  const selectedWidget = selectedWidgetId
    ? widgetSettings.getWidget(selectedWidgetId)
    : undefined;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen();
    }
  };

  useEffect(() => {
    const onChange = () => {
      const fullscreen = !!document.fullscreenElement;

      setIsFullscreen(fullscreen);

      if (!fullscreen) {
        setIsPanelOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', onChange);

    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handlePickBackground = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file || !activeId) {
      return;
    }

    try {
      const extension = (file.name.split('.').pop() ?? 'png').toLowerCase();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const previous = widgetSettings.activeLayout?.backgroundImage;

      const fileName = await saveBackgroundImage(activeId, bytes, extension);

      if (previous && previous !== fileName) {
        void deleteBackgroundImage(previous);
      }

      widgetSettings.setActiveLayoutBackground(fileName);
    } catch (error) {
      console.error('Failed to save background image:', error);
    }
  };

  const handleClearBackground = () => {
    void deleteBackgroundImage(activeLayout?.backgroundImage);
    widgetSettings.setActiveLayoutBackground(undefined);
  };

  const handleDeleteLayout = () => {
    if (!activeId) {
      return;
    }

    void deleteBackgroundImage(widgetSettings.activeLayout?.backgroundImage);
    widgetSettings.deleteLayout(activeId);
  };

  useEffect(() => {
    if (isCreating || isRenaming) {
      nameInputRef.current?.focus?.();
    }
  }, [isCreating, isRenaming]);

  const layoutOptions = widgetSettings.layouts.map((layout) => ({
    value: layout.id,
    label: layout.name,
  }));

  const handleSelectWidget = (id: string) => {
    setSelectedWidgetId(id === '' ? null : id);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();

    if (!trimmed) {
      return;
    }

    widgetSettings.saveLayout(trimmed);
    setNewName('');
    setIsCreating(false);
  };

  const handleRenameConfirm = () => {
    if (activeId && draftName.trim()) {
      widgetSettings.renameLayout(activeId, draftName);
    }

    setIsRenaming(false);
  };

  const handleCreateKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleCreate();
    } else if (event.key === 'Escape') {
      setIsCreating(false);
    }
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleRenameConfirm();
    } else if (event.key === 'Escape') {
      setIsRenaming(false);
    }
  };

  return (
    <div
      className={`${styles.root} ${isFullscreen ? styles.rootFullscreen : ''}`}
      ref={rootRef}
    >
      <header
        className={`${styles.toolbar} ${
          isFullscreen ? styles.toolbarFullscreen : ''
        }`}
      >
        {isFullscreen && (
          <Tooltip title="Toggle widget panel">
            <Button
              size="small"
              type={isPanelOpen ? 'primary' : 'text'}
              icon={<PanelLeft size={14} />}
              onClick={() => setIsPanelOpen((open) => !open)}
            />
          </Tooltip>
        )}

        <div className={styles.layoutControls}>
          {isCreating ? (
            <>
              <Input
                ref={nameInputRef}
                size="small"
                placeholder="New layout name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={handleCreateKeyDown}
                className={styles.nameInput}
              />
              <Tooltip title="Create">
                <Button
                  size="small"
                  type="text"
                  icon={<Check size={14} />}
                  onClick={handleCreate}
                />
              </Tooltip>
              <Tooltip title="Cancel">
                <Button
                  size="small"
                  type="text"
                  icon={<X size={14} />}
                  onClick={() => setIsCreating(false)}
                />
              </Tooltip>
            </>
          ) : isRenaming ? (
            <>
              <Input
                ref={nameInputRef}
                size="small"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={handleRenameKeyDown}
                className={styles.nameInput}
              />
              <Tooltip title="Save name">
                <Button
                  size="small"
                  type="text"
                  icon={<Check size={14} />}
                  onClick={handleRenameConfirm}
                />
              </Tooltip>
              <Tooltip title="Cancel">
                <Button
                  size="small"
                  type="text"
                  icon={<X size={14} />}
                  onClick={() => setIsRenaming(false)}
                />
              </Tooltip>
            </>
          ) : (
            <>
              <Select
                size="small"
                className={styles.layoutSelect}
                placeholder="Select a layout…"
                value={activeId ?? undefined}
                onChange={(id) => widgetSettings.loadLayout(id)}
                options={layoutOptions}
              />

              <Tooltip title="New layout">
                <Button
                  size="small"
                  type="text"
                  icon={<Plus size={14} />}
                  onClick={() => {
                    setNewName('');
                    setIsCreating(true);
                  }}
                />
              </Tooltip>

              <Tooltip title="Rename">
                <Button
                  size="small"
                  type="text"
                  icon={<Pencil size={14} />}
                  disabled={!activeLayout}
                  onClick={() => {
                    setDraftName(activeLayout?.name ?? '');
                    setIsRenaming(true);
                  }}
                />
              </Tooltip>

              <Popconfirm
                title="Delete this layout?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                disabled={!activeId}
                onConfirm={handleDeleteLayout}
              >
                <Tooltip title="Delete">
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<Trash2 size={14} />}
                    disabled={!activeId}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </div>

        <div className={styles.previewControls}>
          {selectedWidget && (
            <div className={styles.coords}>
              <span className={styles.coordLabel}>X</span>
              <InputNumber
                size="small"
                className={styles.coordInput}
                value={selectedWidget.userSettings.x}
                onChange={(value) =>
                  typeof value === 'number' &&
                  widgetSettings.updatePosition(
                    selectedWidget.id,
                    value,
                    selectedWidget.userSettings.y
                  )
                }
              />
              <span className={styles.coordLabel}>Y</span>
              <InputNumber
                size="small"
                className={styles.coordInput}
                value={selectedWidget.userSettings.y}
                onChange={(value) =>
                  typeof value === 'number' &&
                  widgetSettings.updatePosition(
                    selectedWidget.id,
                    selectedWidget.userSettings.x,
                    value
                  )
                }
              />
              <span className={styles.coordLabel}>W</span>
              <InputNumber
                size="small"
                className={styles.coordInput}
                min={10}
                value={selectedWidget.userSettings.currentWidth}
                onChange={(value) =>
                  typeof value === 'number' &&
                  widgetSettings.updateSize(
                    selectedWidget.id,
                    value,
                    selectedWidget.userSettings.currentHeight
                  )
                }
              />
              <span className={styles.coordLabel}>H</span>
              <InputNumber
                size="small"
                className={styles.coordInput}
                min={10}
                value={selectedWidget.userSettings.currentHeight}
                onChange={(value) =>
                  typeof value === 'number' &&
                  widgetSettings.updateSize(
                    selectedWidget.id,
                    selectedWidget.userSettings.currentWidth,
                    value
                  )
                }
              />
            </div>
          )}

          <span className={styles.resolutionLabel}>
            {widgetSettings.overlayResolution.width}×
            {widgetSettings.overlayResolution.height}
          </span>

          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            aria-label="Layout background image"
            hidden
            onChange={(event) => void handlePickBackground(event)}
          />

          <Tooltip title="Toggle alignment grid">
            <Button
              size="small"
              type={showGrid ? 'primary' : 'text'}
              icon={<Grid3x3 size={14} />}
              onClick={() => appSettings.setEditorShowGrid(!showGrid)}
            />
          </Tooltip>

          {showGrid && (
            <Tooltip title="Grid size">
              <Select
                size="small"
                value={gridSize}
                onChange={(value) => appSettings.setEditorGridSize(value)}
                options={GRID_SIZE_OPTIONS}
                style={{ minWidth: 72 }}
              />
            </Tooltip>
          )}

          <Tooltip title="Snap to grid">
            <Button
              size="small"
              type={snapToGrid ? 'primary' : 'text'}
              icon={<Magnet size={14} />}
              onClick={() => appSettings.setEditorSnapToGrid(!snapToGrid)}
            />
          </Tooltip>

          <Tooltip
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
          >
            <Button
              size="small"
              type="text"
              icon={
                isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />
              }
              onClick={toggleFullscreen}
            />
          </Tooltip>

          <Tooltip title="Set editor background (e.g. cockpit view)">
            <Button
              size="small"
              type="text"
              icon={<Image size={14} />}
              disabled={!activeLayout}
              onClick={() => backgroundInputRef.current?.click()}
            />
          </Tooltip>

          {activeLayout?.backgroundImage && (
            <Tooltip title="Clear background">
              <Button
                size="small"
                type="text"
                icon={<ImageOff size={14} />}
                onClick={handleClearBackground}
              />
            </Tooltip>
          )}

          <Select
            size="small"
            value={scenarioId}
            onChange={setScenarioId}
            options={SCENARIO_OPTIONS}
            style={{ minWidth: 150 }}
          />
        </div>
      </header>

      <div
        className={`${styles.body} ${isFullscreen ? styles.bodyFullscreen : ''}`}
      >
        <aside
          className={`${
            isFullscreen ? styles.panelDrawer : styles.panel
          } ${isFullscreen && isPanelOpen ? styles.panelDrawerOpen : ''}`}
        >
          {isFullscreen && (
            <div className={styles.panelDrawerHeader}>
              <span className={styles.panelDrawerTitle}>Widgets</span>
              <Tooltip title="Hide panel">
                <Button
                  size="small"
                  type="text"
                  icon={<PanelLeftClose size={16} />}
                  onClick={() => setIsPanelOpen(false)}
                />
              </Tooltip>
            </div>
          )}

          <LayoutWidgetPanel
            selectedWidgetId={selectedWidgetId}
            editingWidgetId={editingWidgetId}
            onSelectWidget={handleSelectWidget}
            onEditWidget={setEditingWidgetId}
          />
        </aside>

        <main
          className={`${styles.canvas} ${
            isFullscreen ? styles.canvasFullscreen : ''
          }`}
        >
          <LayoutCanvas
            scenarioId={scenarioId}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            gridSize={gridSize}
            fullscreen={isFullscreen}
            selectedWidgetId={selectedWidgetId}
            onSelectWidget={handleSelectWidget}
          />
        </main>
      </div>
    </div>
  );
});
