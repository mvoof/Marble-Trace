import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Flex, Popconfirm } from 'antd';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { TRACK_MAP_CLEAR } from '@store/sync/sim-events';
import {
  useSessionStore,
  useStore,
  useTrackMapWidgetStore,
} from '@store/root-store-context';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

export const TrackMapSection = observer(() => {
  const store = useStore();
  const trackMap = useTrackMapWidgetStore();
  const session = useSessionStore();
  const { message } = App.useApp();
  const { t } = useTranslation('main-app');
  const [resettingPitLane, setResettingPitLane] = useState(false);

  const trackId = trackMap.trackShape?.trackId ?? null;
  const trackDisplayName = session.sessionInfo?.trackDisplayName ?? null;
  const sessionTrackId =
    session.sessionInfo && session.sessionInfo.trackId >= 0
      ? session.sessionInfo.trackId
      : null;

  const playerCar = session.sessionInfo?.cars.find(
    (car) => car.carIdx === session.sessionInfo?.playerCarIdx
  );
  const canDeleteReferenceLap = sessionTrackId !== null && playerCar != null;

  const handleResetPitLane = async () => {
    if (trackId === null) return;

    setResettingPitLane(true);

    try {
      await invoke('reset_pit_lane_pct', { trackId });
      message.success(t('settingsPage.trackMap.pitLaneResetSuccess'));
    } finally {
      setResettingPitLane(false);
    }
  };

  const handleDeleteReferenceLap = async () => {
    if (sessionTrackId === null || !playerCar) return;

    await invoke('delete_reference_lap', {
      trackId: sessionTrackId,
      carScreenName: playerCar.carScreenName,
    });

    store.referenceLap.reset();
    message.success(t('settingsPage.trackMap.referenceLapDeleteSuccess'));
  };

  return (
    <SettingsCard title={t('settingsPage.trackMap.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.trackMap.reRecordTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {t('settingsPage.trackMap.reRecordDesc')}
        </div>

        <Flex gap={8}>
          <Button
            className={styles.buttonFlex}
            size="small"
            danger
            disabled={sessionTrackId === null}
            onClick={() => void emit(TRACK_MAP_CLEAR)}
          >
            {t('settingsPage.trackMap.resetCurrentTrackData')}
          </Button>

          <Button
            className={styles.buttonFlex}
            size="small"
            disabled={sessionTrackId === null}
            onClick={() => {
              void emit('track-map:force-start');
              message.info(t('settingsPage.trackMap.manualStartActive'));
            }}
          >
            {t('settingsPage.trackMap.forceStartRecording')}
          </Button>
        </Flex>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.trackMap.pitLaneCalibrationTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {trackId !== null && trackDisplayName !== null
            ? t('settingsPage.trackMap.pitLaneCalibrationDescWithTrack', {
                track: trackDisplayName,
              })
            : t('settingsPage.trackMap.pitLaneCalibrationDescNoTrack')}
        </div>

        <Button
          block
          size="small"
          danger
          disabled={trackId === null}
          loading={resettingPitLane}
          onClick={() => void handleResetPitLane()}
        >
          {trackDisplayName !== null
            ? t('settingsPage.trackMap.resetPitLaneDataForTrack', {
                track: trackDisplayName,
              })
            : t('settingsPage.trackMap.resetPitLaneData')}
        </Button>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.trackMap.referenceLapTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {canDeleteReferenceLap
            ? t('settingsPage.trackMap.referenceLapDescWithCar', {
                car: playerCar?.carScreenName,
              })
            : t('settingsPage.trackMap.referenceLapDescNoSession')}
        </div>

        <Popconfirm
          title={t('settingsPage.trackMap.deleteReferenceLapConfirm')}
          okText={t('layoutEditor.delete')}
          okButtonProps={{ danger: true }}
          onConfirm={() => void handleDeleteReferenceLap()}
        >
          <Button block size="small" danger disabled={!canDeleteReferenceLap}>
            {t('settingsPage.trackMap.deleteReferenceLap')}
          </Button>
        </Popconfirm>
      </div>
    </SettingsCard>
  );
});
