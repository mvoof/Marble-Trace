import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { resolveBackgroundSrc } from '@entities/layout/layout-background';
import { monitorsBounds } from '@entities/layout/virtual-desktop';
import type { SavedLayout } from '@shared/contracts/widget-settings';

import styles from './LayoutPreview.module.scss';

const PREVIEW_ASPECT = 16 / 9;

const percentOf = (value: number, origin: number, span: number) =>
  `${((value - origin) / span) * 100}%`;

/** A layout's screens and widgets in miniature, letterboxed into a 16:9 card. */
export const LayoutPreview = observer(({ layout }: { layout: SavedLayout }) => {
  const { t } = useTranslation('main-app');
  const [backgrounds, setBackgrounds] = useState<Record<string, string>>({});

  const images = layout.backgroundImages;

  useEffect(() => {
    let active = true;

    const loadBackgrounds = async () => {
      const entries = await Promise.all(
        Object.entries(images ?? {}).map(async ([monitorName, image]) => {
          try {
            return [monitorName, await resolveBackgroundSrc(image)] as const;
          } catch (error) {
            console.error('Failed to resolve background image:', error);

            return null;
          }
        })
      );

      if (!active) return;

      setBackgrounds(
        Object.fromEntries(
          entries.filter((entry): entry is [string, string] => entry !== null)
        )
      );
    };

    void loadBackgrounds();

    return () => {
      active = false;
    };
  }, [images]);

  const desktop = monitorsBounds(layout.monitors);
  const enabledWidgets = layout.widgets.filter(
    (widget) => widget.userSettings.enabled
  );

  // The card is a fixed 16:9 box, but a multi-monitor desktop is any shape at
  // all, so the arrangement is letterboxed inside it rather than stretched.
  const desktopAspect = desktop.width / desktop.height;
  const fitsWidth = desktopAspect >= PREVIEW_ASPECT;

  const stageStyle = {
    width: fitsWidth ? '100%' : `${(desktopAspect / PREVIEW_ASPECT) * 100}%`,
    height: fitsWidth ? `${(PREVIEW_ASPECT / desktopAspect) * 100}%` : '100%',
  };

  return (
    <div className={styles.previewWrapper}>
      <div className={styles.previewStage} style={stageStyle}>
        {layout.monitors.map((monitor) => {
          const background = backgrounds[monitor.name];

          return (
            <div
              key={monitor.name}
              className={styles.previewMonitor}
              style={{
                left: percentOf(monitor.bounds.x, desktop.x, desktop.width),
                top: percentOf(monitor.bounds.y, desktop.y, desktop.height),
                width: percentOf(monitor.bounds.width, 0, desktop.width),
                height: percentOf(monitor.bounds.height, 0, desktop.height),
                backgroundImage: background ? `url(${background})` : undefined,
              }}
            />
          );
        })}

        {enabledWidgets.map((widget) => (
          <div
            key={widget.id}
            className={styles.previewWidget}
            style={{
              left: percentOf(widget.userSettings.x, desktop.x, desktop.width),
              top: percentOf(widget.userSettings.y, desktop.y, desktop.height),
              width: percentOf(
                widget.userSettings.currentWidth,
                0,
                desktop.width
              ),
              height: percentOf(
                widget.userSettings.currentHeight,
                0,
                desktop.height
              ),
            }}
          />
        ))}

        {enabledWidgets.length === 0 && (
          <div className={styles.emptyPreviewText}>
            {t('layoutList.emptyLayout')}
          </div>
        )}
      </div>
    </div>
  );
});
