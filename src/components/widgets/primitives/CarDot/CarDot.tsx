import styles from './CarDot.module.scss';

interface CarDotProps {
  carNumber: string;
  carClassColor: string;
  isPlayer: boolean;
  left: string;
  top: string;
  label?: string;
  labelIsPlayer?: boolean;
}

export const CarDot = ({
  carNumber,
  carClassColor,
  isPlayer,
  left,
  top,
  label,
  labelIsPlayer,
}: CarDotProps) => (
  <div
    className={`${styles.carDot} ${isPlayer ? styles.carDotPlayer : ''}`}
    style={{ left, top, borderColor: carClassColor }}
  >
    <span
      className={`${styles.carNumber} ${isPlayer ? styles.carNumberPlayer : ''}`}
    >
      {carNumber}
    </span>

    {label && (
      <div
        className={`${styles.label} ${labelIsPlayer ? styles.labelPlayer : styles.labelClassLeader}`}
      >
        {label}
      </div>
    )}
  </div>
);
