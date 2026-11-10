import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Space, Spin } from 'antd';
import { ImageUp, Trash2 } from 'lucide-react';

import { SettingRow } from '@features/widget-settings/SettingRow';
import {
  ACCEPTED_WHEEL_IMAGE_TYPES,
  WheelImageImportError,
  importCustomWheelImage,
  resolveCustomWheelSrc,
} from '@features/custom-wheel-image/custom-wheel-image';

import styles from './CustomWheelImageRow.module.scss';

interface CustomWheelImageRowProps {
  image: string | null;
  onChange: (image: string | null) => void;
}

/** Where the stored picture loads from, once its URL is known. */
const usePreviewSrc = (image: string | null): string | null => {
  const [resolved, setResolved] = useState<{
    image: string;
    src: string | null;
  } | null>(null);

  useEffect(() => {
    if (!image) {
      return;
    }

    let cancelled = false;

    void resolveCustomWheelSrc(image).then((src) => {
      if (!cancelled) {
        setResolved({ image, src });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [image]);

  return image && resolved?.image === image ? resolved.src : null;
};

/**
 * Picks the user's own wheel picture. The file is shrunk and stored beside the
 * settings before the setting changes, so the widget only ever points at a
 * small, already written file. The button spins until the stored picture is
 * on screen in the preview below it.
 */
export const CustomWheelImageRow = observer(
  ({ image, onChange }: CustomWheelImageRowProps) => {
    const { t } = useTranslation('widgets');
    const { message } = App.useApp();
    const inputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [shownSrc, setShownSrc] = useState<string | null>(null);
    const previewSrc = usePreviewSrc(image);

    const previewLoading =
      image !== null && (previewSrc === null || previewSrc !== shownSrc);
    const busy = importing || previewLoading;

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      // Cleared so picking the same file again still fires a change.
      event.target.value = '';

      if (!file) {
        return;
      }

      setImporting(true);

      try {
        onChange(await importCustomWheelImage(file));
      } catch (error) {
        const reason =
          error instanceof WheelImageImportError ? error.reason : 'unreadable';

        message.error(
          t(`settingsPanels.inputTrace.customWheelErrors.${reason}`)
        );
      } finally {
        setImporting(false);
      }
    };

    return (
      <>
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

        {(image || importing) && (
          <div className={styles.preview}>
            {busy && <Spin size="small" />}

            {previewSrc && (
              <img
                src={previewSrc}
                alt=""
                draggable={false}
                className={styles.previewImage}
                hidden={previewSrc !== shownSrc}
                onLoad={() => setShownSrc(previewSrc)}
                // A missing file must not leave the button spinning for good.
                onError={() => setShownSrc(previewSrc)}
              />
            )}
          </div>
        )}
      </>
    );
  }
);
