import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Input, Popconfirm, Select, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import { deleteBackgroundImage } from '@entities/layout/layout-background';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import {
  useLayoutEditorStore,
  useLayoutGestureStores,
} from '@features/layout-editor/layout-editor-context';
import {
  createLayout,
  deleteLayout,
} from '@features/layout-editor/layout-gestures';

import styles from './LayoutNameField.module.scss';

type Draft = 'none' | 'creating' | 'renaming';

/**
 * The layout being edited, by name: the picker, and creating, renaming and
 * deleting one. The name being typed lives here — it lasts one gesture.
 */
export const LayoutNameField = observer(() => {
  const layouts = useLayoutsStore();
  const layoutEditor = useLayoutEditorStore();
  const gestureStores = useLayoutGestureStores();
  const { t } = useTranslation('main-app');

  const [draft, setDraft] = useState<Draft>('none');
  const [draftName, setDraftName] = useState('');
  const pendingFocusRef = useRef(false);

  const focusWhenShown = useCallback((node: InputRef | null) => {
    if (node && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      node.focus?.();
    }
  }, []);

  const activeId = layouts.editingLayoutId;
  const editingLayout = layouts.editingLayout;

  const startDraft = (kind: Draft, initialName: string) => {
    setDraftName(initialName);
    pendingFocusRef.current = true;
    setDraft(kind);
  };

  const confirmDraft = () => {
    const trimmed = draftName.trim();

    if (draft === 'creating') {
      if (!trimmed) {
        return;
      }

      void createLayout(gestureStores, trimmed);
    }

    if (draft === 'renaming' && activeId && trimmed) {
      layouts.renameLayout(activeId, draftName);
    }

    setDraft('none');
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // An IME (Japanese/Chinese/Korean) uses Enter to confirm a candidate
    // word; committing here would swallow that keystroke mid-composition.
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter') {
      confirmDraft();
    } else if (event.key === 'Escape') {
      setDraft('none');
    }
  };

  const handleDeleteLayout = () => {
    if (!activeId) {
      return;
    }

    for (const image of Object.values(editingLayout?.backgroundImages ?? {})) {
      void deleteBackgroundImage(image);
    }

    deleteLayout(gestureStores, activeId);
  };

  if (draft !== 'none') {
    return (
      <div className={styles.layoutControls}>
        <Input
          ref={focusWhenShown}
          size="small"
          placeholder={
            draft === 'creating'
              ? t('layoutEditor.newLayoutNamePlaceholder')
              : undefined
          }
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.nameInput}
        />
        <Tooltip
          title={
            draft === 'creating'
              ? t('layoutEditor.create')
              : t('layoutEditor.saveName')
          }
        >
          <Button
            size="small"
            type="text"
            icon={<Check size={14} />}
            onClick={confirmDraft}
          />
        </Tooltip>
        <Tooltip title={t('layoutEditor.cancel')}>
          <Button
            size="small"
            type="text"
            icon={<X size={14} />}
            onClick={() => setDraft('none')}
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={styles.layoutControls}>
      <Select
        size="small"
        className={styles.layoutSelect}
        placeholder={t('layoutEditor.selectLayoutPlaceholder')}
        value={activeId ?? undefined}
        onChange={(id) => layoutEditor.switchLayout(id)}
        options={layouts.layouts.map((layout) => ({
          value: layout.id,
          label: layout.name,
        }))}
      />

      <Tooltip title={t('layoutEditor.newLayout')}>
        <Button
          size="small"
          type="text"
          icon={<Plus size={14} />}
          onClick={() => startDraft('creating', '')}
        />
      </Tooltip>

      <Tooltip title={t('layoutEditor.rename')}>
        <Button
          size="small"
          type="text"
          icon={<Pencil size={14} />}
          disabled={!editingLayout}
          onClick={() => startDraft('renaming', editingLayout?.name ?? '')}
        />
      </Tooltip>

      <Popconfirm
        title={t('layoutEditor.deleteLayoutConfirm')}
        okText={t('layoutEditor.delete')}
        okButtonProps={{ danger: true }}
        cancelText={t('layoutEditor.cancel')}
        disabled={!activeId}
        onConfirm={handleDeleteLayout}
      >
        <Tooltip title={t('layoutEditor.delete')}>
          <Button
            size="small"
            type="text"
            danger
            icon={<Trash2 size={14} />}
            disabled={!activeId}
          />
        </Tooltip>
      </Popconfirm>
    </div>
  );
});
