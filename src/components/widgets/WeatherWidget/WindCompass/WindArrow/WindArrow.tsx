import { observer } from 'mobx-react-lite';

import WindArrowIcon from '../../../../../assets/wind-arrow.svg?react';
import { telemetryStore } from '../../../../../store/iracing/telemetry.store';

// Re-renders at 60 Hz — driven by carDynamics.yaw updating at physics rate
export const WindArrow = observer(
  ({
    windBearing,
    arrowColor,
  }: {
    windBearing: number;
    arrowColor: string;
  }) => {
    const carYawRad = telemetryStore.carDynamics?.yaw ?? 0;
    const carYawDeg = carYawRad * (180 / Math.PI);
    const relativeBearing = (((windBearing - carYawDeg) % 360) + 360) % 360;

    const arrowBaseRadius = 95;
    const arrowHeight = 50;

    return (
      <g
        style={{ transform: `rotate(${relativeBearing}deg)` }}
        pointerEvents="none"
      >
        <WindArrowIcon
          x="-14"
          y={-arrowBaseRadius}
          width="28"
          height={arrowHeight}
          style={{
            color: arrowColor,
            transform: 'rotate(180deg)',
            transformOrigin: `0px ${-arrowBaseRadius + arrowHeight / 2}px`,
          }}
        />
      </g>
    );
  }
);
