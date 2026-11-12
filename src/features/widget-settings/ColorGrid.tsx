import { Fragment } from 'react';
import { observer } from 'mobx-react-lite';
import { ColorPicker } from 'antd';

import styles from '@features/widget-settings/WidgetSettings.module.scss';

export interface ColorGridItem {
  key: string;
  label: string;
  color: string;
}

interface ColorGridProps {
  caption: string;
  items: ColorGridItem[];
  onChange: (key: string, color: string) => void;
}

/** A caption and a row of colour pickers joined by a line. */
export const ColorGrid = observer(
  ({ caption, items, onChange }: ColorGridProps) => (
    <>
      <span className={styles.fieldLabel}>{caption}</span>

      <div className={styles.rpmColorGrid}>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <div className={styles.rpmColorLine} />}

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>{item.label}</span>

              <ColorPicker
                value={item.color}
                onChange={(next) => onChange(item.key, next.toHexString())}
              />
            </div>
          </Fragment>
        ))}
      </div>
    </>
  )
);
