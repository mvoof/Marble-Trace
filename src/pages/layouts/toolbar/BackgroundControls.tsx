import { useRef, type ChangeEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from 'antd';
import { Image, ImageOff } from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';

const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/avif,image/gif';

/**
 * A screen's background picture: set and clear. Background images belong to
 * a screen, so they go to the one in focus — in the overview, the first.
 */
export const BackgroundControls = observer(() => {
  const layouts = useLayoutsStore();
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';
    void editorUi.setBackgroundFromFile(file);
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
        onChange={handlePick}
      />

      <Tooltip title={t('layoutEditor.setBackgroundTooltip')}>
        <Button
          size="small"
          type="text"
          icon={<Image size={14} />}
          disabled={!layouts.editingLayout}
          onClick={() => {
            if (inputRef.current) {
              editorUi.setUploadingBackground(true);
              inputRef.current.click();
            }
          }}
        />
      </Tooltip>

      {editorUi.currentBackground && (
        <Tooltip title={t('layoutEditor.clearBackgroundTooltip')}>
          <Button
            size="small"
            type="text"
            icon={<ImageOff size={14} />}
            onClick={() => editorUi.clearBackground()}
          />
        </Tooltip>
      )}
    </>
  );
});
