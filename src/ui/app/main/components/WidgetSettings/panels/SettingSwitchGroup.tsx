import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Switch } from 'antd';

import { SettingRow } from './SettingRow';

export interface SwitchSetting {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

interface SettingSwitchGroupProps extends SwitchSetting {
  /**
   * Settings that only say how this one's value is written, never whether it is
   * shown. They are hidden while the parent is off — an option that formats a
   * column nobody is looking at answers nothing.
   */
  sub?: SwitchSetting[];
}

export const SettingSwitchGroup = ({
  title,
  desc,
  checked,
  onChange,
  sub,
}: SettingSwitchGroupProps) => (
  <div className={styles.fieldGroup}>
    <SettingRow title={title} desc={desc}>
      <Switch checked={checked} onChange={onChange} />
    </SettingRow>

    {checked &&
      sub?.map((option) => (
        <div key={option.title} className={styles.fieldSubRow}>
          <SettingRow title={option.title} desc={option.desc}>
            <Switch checked={option.checked} onChange={option.onChange} />
          </SettingRow>
        </div>
      ))}
  </div>
);
