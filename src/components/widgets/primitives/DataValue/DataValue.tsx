import styles from './DataValue.module.scss';

type ValueSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
type LabelSize = 'xs' | 'sm';
type Align = 'left' | 'center' | 'right';
type Layout = 'stacked' | 'inline';

interface DataValueProps {
  label: string;
  value: string | number;
  unit?: string;
  size?: ValueSize;
  labelSize?: LabelSize;
  color?: string;
  align?: Align;
  layout?: Layout;
}

export const DataValue = ({
  label,
  value,
  unit,
  size = 'md',
  labelSize = 'xs',
  color,
  align = 'left',
  layout = 'stacked',
}: DataValueProps) => (
  <span
    className={`${styles.container} ${styles[layout]}`}
    style={{
      textAlign: align,
      alignItems:
        align === 'right'
          ? 'flex-end'
          : align === 'center'
            ? 'center'
            : 'flex-start',
    }}
  >
    {label && (
      <span className={`${styles.label} ${styles[`label-${labelSize}`]}`}>
        {label}
      </span>
    )}

    <span
      className={`${styles.value} ${styles[`size-${size}`]}`}
      style={color ? { color } : undefined}
    >
      {value}
    </span>

    {unit && <span className={styles.unit}>{unit}</span>}
  </span>
);
