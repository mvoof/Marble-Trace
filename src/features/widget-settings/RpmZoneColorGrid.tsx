import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { ColorGrid } from './ColorGrid';

/** The rev zone colours, as every widget's settings name them. */
export type RpmZoneColorKey =
  | 'rpmColorLow'
  | 'rpmColorMid'
  | 'rpmColorHigh'
  | 'rpmColorShift'
  | 'rpmColorLimit';

const ZONE_ORDER: RpmZoneColorKey[] = [
  'rpmColorLow',
  'rpmColorMid',
  'rpmColorHigh',
  'rpmColorShift',
  'rpmColorLimit',
];

interface RpmZoneColorGridProps {
  /** The zones this widget paints; the grid draws only these, low to limit. */
  colors: Partial<Record<RpmZoneColorKey, string>>;
  onChange: (key: RpmZoneColorKey, color: string) => void;
}

/**
 * The rev zone colours, low to limit, joined by a line — one picker per zone
 * the widget paints. Every widget that colours by the revs shows them this
 * way, under the same caption.
 */
export const RpmZoneColorGrid = observer(
  ({ colors, onChange }: RpmZoneColorGridProps) => {
    const { t } = useTranslation('widgets');

    const zones = ZONE_ORDER.filter((key) => colors[key] !== undefined);

    return (
      <div className={styles.fieldGroup}>
        <ColorGrid
          caption={t('settingsPanels.common.rpmZoneColors')}
          items={zones.map((key) => ({
            key,
            label: t(`settingsPanels.common.${key}`),
            color: colors[key] ?? '',
          }))}
          onChange={(key, color) => onChange(key as RpmZoneColorKey, color)}
        />
      </div>
    );
  }
);
