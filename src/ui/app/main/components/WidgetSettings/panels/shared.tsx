import type { TFunction } from 'i18next';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import type { LapDeltaReference, LicBadgeStyle } from '@/types/widget-settings';
import { SettingRow } from './SettingRow';

interface LicBadgeStyleRowProps {
  value: LicBadgeStyle | undefined;
  onChange: (next: LicBadgeStyle) => void;
}

/**
 * How the SR value is drawn. Standings and Relative offer the same three, so
 * the row itself is shared rather than written out twice.
 */
export const LicBadgeStyleRow = observer(
  ({ value, onChange }: LicBadgeStyleRowProps) => {
    const { t } = useTranslation('widgets');

    return (
      <SettingRow
        title={t('settingsPanels.common.licBadgeStyle')}
        desc={t('settingsPanels.common.licBadgeStyleDesc')}
      >
        <Segmented<LicBadgeStyle>
          value={value ?? 'badge'}
          onChange={onChange}
          options={[
            {
              label: t('settingsPanels.common.licBadgeStyleBadge'),
              value: 'badge',
            },
            {
              label: t('settingsPanels.common.licBadgeStylePlain'),
              value: 'plain',
            },
            {
              label: t('settingsPanels.common.licBadgeStyleDark'),
              value: 'dark',
            },
          ]}
        />
      </SettingRow>
    );
  }
);

export const getDeltaReferenceDesc = (
  t: TFunction
): Record<LapDeltaReference, string> => ({
  personal_best: t('settingsPanels.delta.referenceDesc.personalBest', {
    ns: 'widgets',
  }),
  personal_optimal: t('settingsPanels.delta.referenceDesc.personalOptimal', {
    ns: 'widgets',
  }),
  session_best: t('settingsPanels.delta.referenceDesc.sessionBest', {
    ns: 'widgets',
  }),
  session_optimal: t('settingsPanels.delta.referenceDesc.sessionOptimal', {
    ns: 'widgets',
  }),
  session_last: t('settingsPanels.delta.referenceDesc.sessionLast', {
    ns: 'widgets',
  }),
});
