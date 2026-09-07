import { observer } from 'mobx-react-lite';

interface MarkerIconProps {
  scale: number;
}

interface CrownIconProps extends MarkerIconProps {
  color: string;
}

export const ChevronIcon = observer(({ scale }: MarkerIconProps) => {
  return (
    <g transform={`scale(${scale})`}>
      <path
        d="M -6,-4 L 0,2 L 6,-4"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.8))' }}
      />
      <path
        d="M -6,-9 L 0,-3 L 6,-9"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </g>
  );
});

ChevronIcon.displayName = 'ChevronIcon';

export const CrownIcon = observer(({ scale, color }: CrownIconProps) => {
  return (
    <g transform={`scale(${scale})`}>
      {/* Crown body */}
      <polygon
        points="-6,0 -8,-8 -3,-4 0,-10 3,-4 8,-8 6,0"
        fill={color}
        stroke="#18181b"
        strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.8))' }}
      />
      {/* Crown base line */}
      <line
        x1="-5"
        y1="2"
        x2="5"
        y2="2"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  );
});

CrownIcon.displayName = 'CrownIcon';
