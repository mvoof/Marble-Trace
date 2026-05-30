import React from 'react';
import { observer } from 'mobx-react-lite';
import { RotateCw, RotateCcw } from 'lucide-react';
import styles from './RotationControls.module.scss';

interface RotationControlsProps {
  onRotate: (direction: 'cw' | 'ccw') => void;
}

interface RotateButtonProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

const RotateButton = observer(
  ({ title, onClick, children }: RotateButtonProps) => (
    <button
      className={styles.rotateButton}
      title={title}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  )
);

export const RotationControls = observer(
  ({ onRotate }: RotationControlsProps) => {
    return (
      <div className={styles.rotationControls}>
        <RotateButton
          title="Rotate 90° Counter-Clockwise"
          onClick={() => onRotate('ccw')}
        >
          <RotateCcw />
        </RotateButton>

        <RotateButton
          title="Rotate 90° Clockwise"
          onClick={() => onRotate('cw')}
        >
          <RotateCw />
        </RotateButton>
      </div>
    );
  }
);
