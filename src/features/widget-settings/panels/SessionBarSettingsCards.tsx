import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SESSION_BAR_SETTINGS } from '@entities/session/session-bar-settings';
import { Card } from '../Card';
import { schemaRows } from '../schema-rows';

const { Row } = schemaRows(SESSION_BAR_SETTINGS);

export const SessionBarSettingsCards = observer(
  ({ trackNameRow }: { trackNameRow?: ReactNode }) => {
    const { t } = useTranslation('widgets');

    return (
      <>
        <Card title={t('settingsPanels.common.headerInfo')}>
          <Row setting="showSessionType" />
          {trackNameRow}
          <Row setting="showTotalDrivers" />
          <Row setting="showSOF" />
          <Row setting="abbreviateSof" dependsOn="showSOF" />
          <Row setting="showLapProgress" />
          <Row setting="lapCounter" dependsOn="showLapProgress" />
          <Row setting="showSessionTime" />
          <Row setting="headerChipStyle" stacked wrapOptions />
          <Row setting="headerChipLabelMode" stacked wrapOptions />
        </Card>
        <Card title={t('settingsPanels.common.footerInfo')}>
          <Row setting="showAirTemp" />
          <Row setting="showTrackTemp" />
          <Row setting="showTrackWetness" />
          <Row setting="showPitStops" />
          <Row setting="showIncidentsBadge" />
          <Row setting="showPenalties" />
          <Row setting="footerChipStyle" stacked wrapOptions />
          <Row setting="footerChipLabelMode" stacked wrapOptions />
        </Card>
      </>
    );
  }
);
