import { useRef, type ChangeEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from 'antd';
import { Image, ImageOff } from 'lucide-react';

import {
  deleteBackgroundImage,
  saveBackgroundImage,
} from '@entities/layout/layout-background';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';

const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/avif,image/gif';
const DEFAULT_EXTENSION = 'png';

/**
 * A screen's background picture: set and clear. Background images belong to
 * a screen, so they go to the one in focus — in the overview, the first.
 */
export const BackgroundControls = observer(() => {
  const layouts = useLayoutsStore();
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeId = layouts.editingLayoutId;
  const editingLayout = layouts.editingLayout;
  const targetName =
    editorUi.focusedMonitorName ?? editingLayout?.monitors[0]?.name;
  const current = targetName
    ? editingLayout?.backgroundImages?.[targetName]
    : undefined;

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file || !activeId) {
      editorUi.setUploadingBackground(false);

      return;
    }

    try {
      const extension = (
        file.name.split('.').pop() ?? DEFAULT_EXTENSION
      ).toLowerCase();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileName = await saveBackgroundImage(activeId, bytes, extension);

      if (current && current !== fileName) {
        void deleteBackgroundImage(current);
      }

      if (targetName) {
        layouts.setMonitorBackground(targetName, fileName);
      }
    } catch (error) {
      console.error('Failed to save background image:', error);
    } finally {
      editorUi.setUploadingBackground(false);
    }
  };

  const handleClear = () => {
    if (!targetName) {
      return;
    }

    void deleteBackgroundImage(current);
    layouts.setMonitorBackground(targetName, undefined);
  };

  return (
    <>
      <input
        ref={(node) => {
          inputRef.current = node;

          if (node) {
            node.oncancel = () => editorUi.setUploadingBackground(false);
          }
        }}
        type="file"
        accept={ACCEPTED_IMAGES}
        aria-label={t('layoutEditor.backgroundImageAria')}
        hidden
        onChange={(event) => void handlePick(event)}
      />

      <Tooltip title={t('layoutEditor.setBackgroundTooltip')}>
        <Button
          size="small"
          type="text"
          icon={<Image size={14} />}
          disabled={!editingLayout}
          onClick={() => {
            if (inputRef.current) {
              editorUi.setUploadingBackground(true);
              inputRef.current.click();
            }
          }}
        />
      </Tooltip>

      {current && (
        <Tooltip title={t('layoutEditor.clearBackgroundTooltip')}>
          <Button
            size="small"
            type="text"
            icon={<ImageOff size={14} />}
            onClick={handleClear}
          />
        </Tooltip>
      )}
    </>
  );
});
