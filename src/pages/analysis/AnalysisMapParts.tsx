import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minus, Plus } from 'lucide-react';

import styles from './AnalysisMap.module.scss';

const ICON_SIZE = 14;

/**
 * Zoom in, out and the whole lap. The buttons only carry their action:
 * `attachMapGestures` finds them under `data-map-tools` and acts on clicks.
 */
export const MapTools = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <div className={styles.tools} data-map-tools>
      <button
        type="button"
        data-map-action="in"
        title={t('dataPage.analysis.zoomIn')}
      >
        <Plus size={ICON_SIZE} />
      </button>
      <button
        type="button"
        data-map-action="out"
        title={t('dataPage.analysis.zoomOut')}
      >
        <Minus size={ICON_SIZE} />
      </button>
      <button
        type="button"
        data-map-action="fit"
        title={t('dataPage.analysis.wholeLap')}
      >
        <Maximize2 size={ICON_SIZE} />
      </button>
    </div>
  );
});
