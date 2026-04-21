import { WidgetPanel } from '../primitives/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';

import styles from './WeatherWidget.module.scss';

interface WeatherWidgetProps {
  windBearing: number;
  carYawDeg: number;
  windSpeedFormatted: string;
  windCardinal: string;
  airTempFormatted: string;
  trackTempFormatted: string;
  tempUnit: string;
  humidity: string;
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
}

export const WeatherWidget = ({
  windBearing,
  carYawDeg,
  windSpeedFormatted,
  windCardinal,
  airTempFormatted,
  trackTempFormatted,
  tempUnit,
  humidity,
  showCompass,
  showAirTemp,
  showTrackTemp,
  showWind,
  showHumidity,
}: WeatherWidgetProps) => (
  <WidgetPanel direction="column" gap={0} minWidth={180}>
    <div className={styles.header}>
      <span className={styles.headerLabel}>CONDITIONS</span>
    </div>

    {showCompass && (
      <div className={styles.compassBlock}>
        <WindCompass
          windBearing={windBearing}
          carYawDeg={carYawDeg}
          size={86}
        />
        <div className={styles.compassInfo}>
          <span className={styles.windSpeed}>{windSpeedFormatted}</span>
          <span className={styles.windCardinal}>{windCardinal}</span>
        </div>
      </div>
    )}

    {showAirTemp && (
      <div className={styles.infoBlock}>
        <span className={styles.infoLabel}>AIR</span>
        <span className={styles.infoValue}>
          {airTempFormatted}
          <span className={styles.infoUnit}>{tempUnit}</span>
        </span>
      </div>
    )}

    {showTrackTemp && (
      <div className={styles.infoBlock}>
        <span className={styles.infoLabel}>TRACK</span>
        <span className={styles.infoValue}>
          {trackTempFormatted}
          <span className={styles.infoUnit}>{tempUnit}</span>
        </span>
      </div>
    )}

    {showWind && (
      <div className={styles.infoBlock}>
        <span className={styles.infoLabel}>WIND</span>
        <span className={styles.infoValue}>
          {windSpeedFormatted}
          <span className={styles.infoSubValue}> {windCardinal}</span>
        </span>
      </div>
    )}

    {showHumidity && (
      <div className={styles.infoBlock}>
        <span className={styles.infoLabel}>HUM.</span>
        <span className={styles.infoValue}>{humidity}</span>
      </div>
    )}
  </WidgetPanel>
);
