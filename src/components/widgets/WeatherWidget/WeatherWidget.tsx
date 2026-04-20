import type { ReactNode } from 'react';
import {
  Cloud,
  CloudRain,
  CloudSun,
  MapPin,
  Sun,
  Thermometer,
} from 'lucide-react';

import { WidgetPanel } from '../primitives/WidgetPanel';
import type { SkiesIconType } from './weather-utils';
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
  skiesText: string;
  skiesIcon: SkiesIconType;
}

const SKIES_ICON_MAP: Record<SkiesIconType, ReactNode> = {
  sun: <Sun size={14} />,
  'cloud-sun': <CloudSun size={14} />,
  cloud: <Cloud size={14} />,
  'cloud-rain': <CloudRain size={14} />,
};

export const WeatherWidget = ({
  windBearing,
  carYawDeg,
  windSpeedFormatted,
  windCardinal,
  airTempFormatted,
  trackTempFormatted,
  tempUnit,
  skiesText,
  skiesIcon,
}: WeatherWidgetProps) => (
  <WidgetPanel direction="column" gap={0} minWidth={200}>
    <div className={styles.topSection}>
      <div className={styles.compassWrapper}>
        <WindCompass
          windBearing={windBearing}
          carYawDeg={carYawDeg}
          size={110}
        />
      </div>

      <div className={styles.windInfo}>
        <span className={styles.windSpeed}>{windSpeedFormatted}</span>
        <span className={styles.windCardinal}>{windCardinal}</span>
        <span className={styles.windLabel}>WIND</span>
      </div>
    </div>

    <div className={styles.divider} />

    <div className={styles.tempRow}>
      <div className={styles.tempItem}>
        <span className={styles.tempIcon} style={{ color: '#3399ff' }}>
          <Thermometer size={13} />
        </span>
        <span className={styles.tempLabel}>AIR</span>
        <span className={styles.tempValue}>
          {airTempFormatted}
          <span className={styles.tempUnit}>{tempUnit}</span>
        </span>
      </div>

      <div className={styles.tempDivider} />

      <div className={styles.tempItem}>
        <span className={styles.tempIcon} style={{ color: '#ff9933' }}>
          <MapPin size={13} />
        </span>
        <span className={styles.tempLabel}>TRACK</span>
        <span className={styles.tempValue}>
          {trackTempFormatted}
          <span className={styles.tempUnit}>{tempUnit}</span>
        </span>
      </div>
    </div>

    <div className={styles.divider} />

    <div className={styles.skiesRow}>
      <span className={styles.skiesIcon} style={{ color: '#aaaaaa' }}>
        {SKIES_ICON_MAP[skiesIcon]}
      </span>
      <span className={styles.skiesText}>{skiesText || 'Unknown'}</span>
    </div>
  </WidgetPanel>
);
