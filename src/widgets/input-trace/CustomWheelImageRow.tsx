import { useRef, useState, type ChangeEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Space } from 'antd';
import { ImageUp, Trash2 } from 'lucide-react';

import { SettingRow } from '@features/widget-settings/SettingRow';
import {
  ACCEPTED_WHEEL_IMAGE_TYPES,
  WheelImageImportError,
  importCustomWheelImage,
} from '@features/custom-wheel-image/custom-wheel-image';

interface CustomWheelImageRowProps {
  image: string | null;
  onChange: (image: string | null) => void;
}

/**
 * Picks the user's own wheel picture. The file is shrunk and stored beside the
 * settings before the setting changes, so the widget only ever points at a
 * small, already written file.
 */
export const CustomWheelImageRow = observer(
  ({ image, onChange }: CustomWheelImageRowProps) => {
    const { t } = useTranslation('widgets');
    const { message } = App.useApp();
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      // Cleared so picking the same file again still fires a change.
      event.target.value = '';

      if (!file) {
        return;
      }

      setBusy(true);

      try {
        onChange(await importCustomWheelImage(file));
      } catch (error) {
        const reason =
          error instanceof WheelImageImportError ? error.reason : 'unreadable';

        message.error(
          t(`settingsPanels.inputTrace.customWheelErrors.${reason}`)
        );
      } finally {
        setBusy(false);
      }
    };

    return (
      <SettingRow
        title={t('settingsPanels.inputTrace.customWheelImage')}
        desc={t(
          image
            ? 'settingsPanels.inputTrace.customWheelImageSet'
            : 'settingsPanels.inputTrace.customWheelImageDesc'
        )}
      >
        <Space>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_WHEEL_IMAGE_TYPES.join(',')}
            hidden
            onChange={(event) => void handleFile(event)}
          />

          <Button
            icon={<ImageUp size={14} />}
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {t('settingsPanels.inputTrace.customWheelPick')}
          </Button>

          {image && (
            <Button
              icon={<Trash2 size={14} />}
              disabled={busy}
              onClick={() => onChange(null)}
              aria-label={t('settingsPanels.inputTrace.customWheelRemove')}
            />
          )}
        </Space>
      </SettingRow>
    );
  }
);
