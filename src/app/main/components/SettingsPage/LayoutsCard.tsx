import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, Popconfirm, Select, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { Save, Trash2, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { useWidgetSettingsStore } from '@store/root-store-context';
import styles from './LayoutsCard.module.scss';

export const LayoutsCard = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const renameInputRef = useRef<InputRef | null>(null);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus?.();
    }
  }, [renamingId]);

  const selectedId = widgetSettings.activeLayoutId;

  const selectedLayout = widgetSettings.layouts.find(
    (layout) => layout.id === selectedId
  );

  const handleSave = () => {
    const trimmed = newName.trim();

    if (!trimmed) return;

    widgetSettings.saveLayout(trimmed);
    setNewName('');
  };

  const handleSaveKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSave();
    }
  };

  const handleStartRename = () => {
    if (!selectedLayout) return;

    setDraftName(selectedLayout.name);
    setRenamingId(selectedLayout.id);
  };

  const handleRenameConfirm = () => {
    if (renamingId && draftName.trim()) {
      widgetSettings.renameLayout(renamingId, draftName);
    }

    setRenamingId(null);
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleRenameConfirm();
    } else if (event.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;

    widgetSettings.deleteLayout(selectedId);
  };

  const selectOptions = widgetSettings.layouts.map((layout) => ({
    value: layout.id,
    label: layout.name,
  }));

  return (
    <div className={styles.root}>
      <div className={styles.saveRow}>
        <Input
          placeholder="Layout name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={handleSaveKeyDown}
          className={styles.nameInput}
        />

        <Button
          type="primary"
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={!newName.trim()}
        >
          Save current
        </Button>
      </div>

      {widgetSettings.layouts.length > 0 && (
        <div className={styles.selectRow}>
          {renamingId ? (
            <Input
              ref={renameInputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={handleRenameKeyDown}
              className={styles.renameInput}
            />
          ) : (
            <Select
              className={styles.select}
              placeholder="Select a layout…"
              value={selectedId ?? undefined}
              onChange={(id) => widgetSettings.loadLayout(id)}
              options={selectOptions}
            />
          )}

          <div className={styles.actions}>
            {renamingId ? (
              <>
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
                    onClick={handleRenameCancel}
                  />
                </Tooltip>
              </>
            ) : (
              <>
                <Popconfirm
                  title="Update this layout?"
                  description="The saved layout will be overwritten with current settings."
                  okText="Update"
                  cancelText="Cancel"
                  onConfirm={() =>
                    selectedId && widgetSettings.updateLayout(selectedId)
                  }
                  disabled={!selectedId}
                >
                  <Tooltip title="Update layout with current settings">
                    <Button
                      size="small"
                      type="text"
                      icon={<RefreshCw size={14} />}
                      disabled={!selectedId}
                    />
                  </Tooltip>
                </Popconfirm>

                <Tooltip title="Rename">
                  <Button
                    size="small"
                    type="text"
                    icon={<Pencil size={14} />}
                    disabled={!selectedId}
                    onClick={handleStartRename}
                  />
                </Tooltip>

                <Popconfirm
                  title="Delete this layout?"
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  cancelText="Cancel"
                  onConfirm={handleDelete}
                  disabled={!selectedId}
                >
                  <Tooltip title="Delete">
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<Trash2 size={14} />}
                      disabled={!selectedId}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
