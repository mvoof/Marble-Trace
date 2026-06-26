import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, Popconfirm, Select, Tooltip } from 'antd';
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
} from 'lucide-react';
import { useWidgetSettingsStore } from '@store/root-store-context';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { LayoutCanvas } from './LayoutCanvas';
import { LayoutWidgetPanel } from './LayoutWidgetPanel';
import styles from './LayoutEditor.module.scss';

const SCENARIO_OPTIONS = PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

// Layout editor section: a WYSIWYG canvas of the active layout plus a
// master-detail widget panel. Editing the canvas (drag/resize) or a widget's
// settings auto-commits into the active layout via the store's change reaction.
export const LayoutEditor = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);
  const [showGrid, setShowGrid] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef<InputRef | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);

  const activeId = widgetSettings.activeLayoutId;
  const activeLayout = widgetSettings.activeLayout;

  const handlePickBackground = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      widgetSettings.setActiveLayoutBackground(reader.result as string);
    };

    reader.readAsDataURL(file);
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
    <div className={styles.root}>
      <header className={styles.toolbar}>
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
                onConfirm={() =>
                  activeId && widgetSettings.deleteLayout(activeId)
                }
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
          {activeLayout && (
            <span className={styles.activeBadge}>
              <span className={styles.activeDot} />
              Active
            </span>
          )}

          <span className={styles.resolutionLabel}>
            {widgetSettings.overlayResolution.width}×
            {widgetSettings.overlayResolution.height}
          </span>

          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            aria-label="Layout background image"
            hidden
            onChange={handlePickBackground}
          />

          <Tooltip title="Toggle alignment grid">
            <Button
              size="small"
              type={showGrid ? 'primary' : 'text'}
              icon={<Grid3x3 size={14} />}
              onClick={() => setShowGrid((prev) => !prev)}
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
                onClick={() =>
                  widgetSettings.setActiveLayoutBackground(undefined)
                }
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

      <div className={styles.body}>
        <aside className={styles.panel}>
          <LayoutWidgetPanel
            selectedWidgetId={selectedWidgetId}
            editingWidgetId={editingWidgetId}
            onSelectWidget={handleSelectWidget}
            onEditWidget={setEditingWidgetId}
          />
        </aside>

        <main className={styles.canvas}>
          <LayoutCanvas
            scenarioId={scenarioId}
            showGrid={showGrid}
            selectedWidgetId={selectedWidgetId}
            onSelectWidget={handleSelectWidget}
          />
        </main>
      </div>
    </div>
  );
});
