import type {
  RadarBackgroundTexture,
  RadarScaleMode,
} from '@/types/widget-settings';

/** Average car body width in meters — the icon is the footprint, not a dot. */
export const CAR_WIDTH_M = 1.8;

/** Corner rounding of the car icon, in meters of body. */
export const CAR_CORNER_RADIUS_M = 0.35;

/**
 * How far to the side an alongside car is drawn. The sim never reports a
 * lateral position, so this is a constant, not a measurement — wide enough that
 * the beam tracking a side car clears the player's own body.
 */
export const SIDE_LATERAL_OFFSET_M = 3.4;

/** Two cars closer than this along the lane read as one row, not a queue. */
export const SAME_ROW_M = 2.5;

/** 180 px of widget covers a 10 m radius. */
export const DESIGN_SIZE_PX = 180;
export const DESIGN_SCOPE_RANGE_M = 10;

/** Longitudinal scale ticks — the one axis the sim actually measures. */
export const LADDER_STEP_M = 2.5;

/** Padding around the body's own angular footprint, in radians. */
const BEAM_PADDING_RAD = (2 * Math.PI) / 180;

/** Smallest legible in-body label and the room it needs around it. */
const MIN_LABEL_PX = 8;
const MAX_LABEL_PX = 13;
const LABEL_SIDE_PADDING_PX = 2;
const LABEL_PX_PER_METER = 1.3;

const AXIS_GAP_M = 1.4;
const RING_COUNT = 2;
const TEXTURE_RING_COUNT = 5;
const TEXTURE_DOTS_PER_RING = 8;
const TEXTURE_MESH_STEP_DEG = 15;
const TEXTURE_HATCH_STEP_PX = 7;
/** The ink every texture is drawn with — a wash, not a user-tuned dial. */
const TEXTURE_ALPHA = 0.02;
const TEXTURE_SCANLINE_STEP_PX = 4;
const EDGE_MARKER_HALF_ANGLE_RAD = 0.16;

const GRID_INK = 'rgba(250, 250, 250, 0.2)';
const LADDER_INK = 'rgba(250, 250, 250, 0.32)';
const EDGE_MARKER_INK = 'rgba(250, 250, 250, 0.45)';
const OPPONENT_INK = 'rgba(250, 250, 250, 0.82)';
const PLAYER_INK = 'rgba(250, 250, 250, 0.9)';
const LABEL_ON_LIGHT = 'rgba(8, 9, 10, 0.92)';
const LABEL_ON_DARK = 'rgba(250, 250, 250, 0.92)';

/** Threat thresholds in meters of bumper-to-bumper gap. */
const DANGER_GAP_M = 1;
const WARNING_GAP_M = 2.5;

const THREAT_COLORS = {
  danger: '#ff2a55',
  warning: '#eab308',
  safe: '#22c55e',
} as const;

export const threatColorForGap = (gapMeters: number): string => {
  const gap = Math.abs(gapMeters);

  if (gap <= DANGER_GAP_M) {
    return THREAT_COLORS.danger;
  }

  if (gap <= WARNING_GAP_M) {
    return THREAT_COLORS.warning;
  }

  return THREAT_COLORS.safe;
};

const withAlpha = (hex: string, alpha: number): string => {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const channelLuminance = (value: number): number => {
  const srgb = value / 255;

  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const parseChannels = (color: string): [number, number, number] => {
  if (color.startsWith('#')) {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  }

  const parts = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];

  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

/**
 * Ink that stays readable on the body it sits on — the label lives *inside* the
 * car, and the body is white today but carries a threat color when the user
 * turns the monochrome icons off.
 */
export const readableOn = (bodyColor: string): string => {
  const [red, green, blue] = parseChannels(bodyColor);

  const luminance =
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue);

  return luminance > 0.45 ? LABEL_ON_LIGHT : LABEL_ON_DARK;
};

interface ScaleInput {
  scaleMode: RadarScaleMode;
  scopeRange: number;
  /** Half of the widget's rendered side, in CSS pixels. */
  radiusPx: number;
  widgetScale: number;
}

export interface ScopeScale {
  pxPerMeter: number;
  /** Meters the circle actually covers, whichever mode produced them. */
  rangeMeters: number;
}

/**
 * One knob decides both the zoom and what fits in the circle, and the user
 * picks which one it is.
 */
export const resolveScopeScale = ({
  scaleMode,
  scopeRange,
  radiusPx,
  widgetScale,
}: ScaleInput): ScopeScale => {
  const designPxPerMeter = DESIGN_SIZE_PX / 2 / DESIGN_SCOPE_RANGE_M;

  if (scaleMode === 'fixed-cars') {
    return {
      pxPerMeter: designPxPerMeter,
      rangeMeters: radiusPx / designPxPerMeter,
    };
  }

  if (scaleMode === 'manual') {
    // A hand-edited file can carry a zero or a negative here, and a scope of
    // zero meters is an infinite pxPerMeter — every car drawn as a full-screen
    // block. Fall back to the design range instead.
    const range =
      Number.isFinite(scopeRange) && scopeRange > 0
        ? scopeRange
        : DESIGN_SCOPE_RANGE_M;

    return { pxPerMeter: radiusPx / range, rangeMeters: range };
  }

  const pxPerMeter = designPxPerMeter * widgetScale;

  return { pxPerMeter, rangeMeters: radiusPx / pxPerMeter };
};

export interface BearingSpan {
  center: number;
  half: number;
}

/**
 * Angular footprint of a car body as seen from the player: the beam is as wide
 * as the car it follows, so a close opponent lights a wide sector and a distant
 * one a narrow slice.
 */
export const carBearingSpan = (
  lateralM: number,
  longitudinalM: number,
  carLengthM: number
): BearingSpan => {
  const center = Math.atan2(lateralM, longitudinalM);
  let min = 0;
  let max = 0;

  [-CAR_WIDTH_M / 2, CAR_WIDTH_M / 2].forEach((cornerX) => {
    [-carLengthM / 2, carLengthM / 2].forEach((cornerY) => {
      const bearing = Math.atan2(lateralM + cornerX, longitudinalM + cornerY);

      const offset = Math.atan2(
        Math.sin(bearing - center),
        Math.cos(bearing - center)
      );

      min = Math.min(min, offset);
      max = Math.max(max, offset);
    });
  });

  return {
    center: center + (min + max) / 2,
    half: (max - min) / 2 + BEAM_PADDING_RAD,
  };
};

export interface LaneRow {
  /** Signed offset along the lane, positive ahead. */
  longitudinal: number;
  /** How many cars share this row — drawn as one body and a `×N`. */
  count: number;
}

/**
 * Cars alongside, collapsed into rows. The sim gives a longitudinal offset per
 * car and no lateral one, so a queue is drawn where it really is along the lane
 * and an actual row becomes one icon with a count rather than an invented
 * second column.
 */
export const collapseLaneRows = (offsets: number[]): LaneRow[] => {
  const rows: LaneRow[] = [];

  [...offsets]
    .sort((first, second) => Math.abs(first) - Math.abs(second))
    .forEach((offset) => {
      const existing = rows.find(
        (row) => Math.abs(row.longitudinal - offset) < SAME_ROW_M
      );

      if (existing) {
        existing.count += 1;

        return;
      }

      rows.push({ longitudinal: offset, count: 1 });
    });

  return rows;
};

export const labelFontPx = (pxPerMeter: number): number =>
  Math.min(MAX_LABEL_PX, Math.round(pxPerMeter * LABEL_PX_PER_METER));

/** Optional texture — over the plate, or on its own when the plate is clear. */
export const drawTexture = (
  ctx: CanvasRenderingContext2D,
  texture: RadarBackgroundTexture,
  radiusPx: number
): void => {
  if (texture === 'none') {
    return;
  }

  const ink = `rgba(250, 250, 250, ${TEXTURE_ALPHA})`;

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1;

  if (texture === 'polar-dots') {
    for (let ring = 1; ring <= TEXTURE_RING_COUNT; ring += 1) {
      const ringRadius = (radiusPx / TEXTURE_RING_COUNT) * ring;
      const dots = ring * TEXTURE_DOTS_PER_RING;

      for (let dot = 0; dot < dots; dot += 1) {
        const angle = (dot / dots) * Math.PI * 2;

        ctx.beginPath();
        ctx.arc(
          Math.cos(angle) * ringRadius,
          Math.sin(angle) * ringRadius,
          0.9,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  if (texture === 'polar-mesh') {
    for (let deg = 0; deg < 360; deg += TEXTURE_MESH_STEP_DEG) {
      const angle = (deg * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * radiusPx, Math.sin(angle) * radiusPx);
      ctx.stroke();
    }

    for (let ring = 1; ring <= TEXTURE_RING_COUNT; ring += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, (radiusPx / TEXTURE_RING_COUNT) * ring, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (texture === 'hatch') {
    // The lines run at 45 degrees, so the family is swept along its own
    // perpendicular: sweeping x instead leaves the disc covered on one side
    // and bare on the other.
    const halfDiagonal = radiusPx * Math.SQRT2;

    ctx.save();
    ctx.rotate(Math.PI / 4);

    for (
      let offset = -halfDiagonal;
      offset <= halfDiagonal;
      offset += TEXTURE_HATCH_STEP_PX
    ) {
      ctx.beginPath();
      ctx.moveTo(offset, -halfDiagonal);
      ctx.lineTo(offset, halfDiagonal);
      ctx.stroke();
    }

    ctx.restore();
  }

  if (texture === 'scanlines') {
    for (let y = -radiusPx; y < radiusPx; y += TEXTURE_SCANLINE_STEP_PX) {
      ctx.beginPath();
      ctx.moveTo(-radiusPx, y);
      ctx.lineTo(radiusPx, y);
      ctx.stroke();
    }
  }

  ctx.restore();
};

interface GridInput {
  radiusPx: number;
  pxPerMeter: number;
  rangeMeters: number;
  carLengthM: number;
  showAxes: boolean;
  showAxisTicks: boolean;
  showRangeRings: boolean;
}

/**
 * Rings and axes, never a lateral scale: the sim measures along the track and
 * nothing across it, so the ladder ticks live on the vertical axis alone.
 */
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  {
    radiusPx,
    pxPerMeter,
    rangeMeters,
    carLengthM,
    showAxes,
    showAxisTicks,
    showRangeRings,
  }: GridInput
): void => {
  if (showRangeRings) {
    ctx.save();
    ctx.strokeStyle = GRID_INK;
    ctx.lineWidth = 1;

    rangeRingRadii(rangeMeters).forEach((meters) => {
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        Math.min(meters * pxPerMeter, radiusPx - 0.5),
        0,
        Math.PI * 2
      );
      ctx.stroke();
    });

    ctx.restore();
  }

  if (!showAxes) {
    return;
  }

  const lateralGap = AXIS_GAP_M * pxPerMeter;
  const bodyGap = (carLengthM / 2) * pxPerMeter + 4;

  ctx.save();
  ctx.strokeStyle = GRID_INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radiusPx, 0);
  ctx.lineTo(-lateralGap, 0);
  ctx.moveTo(lateralGap, 0);
  ctx.lineTo(radiusPx, 0);
  ctx.moveTo(0, -radiusPx);
  ctx.lineTo(0, -bodyGap);
  ctx.moveTo(0, bodyGap);
  ctx.lineTo(0, radiusPx);
  ctx.stroke();

  if (!showAxisTicks) {
    ctx.restore();

    return;
  }

  ctx.strokeStyle = LADDER_INK;

  for (
    let meters = LADDER_STEP_M;
    meters <= rangeMeters;
    meters += LADDER_STEP_M
  ) {
    const y = meters * pxPerMeter;
    const halfTick = meters % (LADDER_STEP_M * 2) === 0 ? 5 : 3;

    ctx.beginPath();
    ctx.moveTo(-halfTick, -y);
    ctx.lineTo(halfTick, -y);
    ctx.moveTo(-halfTick, y);
    ctx.lineTo(halfTick, y);
    ctx.stroke();
  }

  ctx.restore();
};

/** Half the scope and its rim — the two rings follow whatever the scale is. */
export const rangeRingRadii = (rangeMeters: number): number[] =>
  Array.from(
    { length: RING_COUNT },
    (_, index) => (rangeMeters / RING_COUNT) * (index + 1)
  );

interface BeamInput {
  span: BearingSpan;
  distanceMeters: number;
  rangeMeters: number;
  pxPerMeter: number;
  radiusPx: number;
  color: string;
}

/** The sector that follows an opponent for as long as it is in the scope. */
export const drawBeam = (
  ctx: CanvasRenderingContext2D,
  { span, distanceMeters, rangeMeters, pxPerMeter, radiusPx, color }: BeamInput
): void => {
  const fade = Math.max(0.15, 1 - distanceMeters / rangeMeters);
  const stop = Math.min(
    0.92,
    Math.max(0.08, (distanceMeters * pxPerMeter) / radiusPx)
  );

  const gradient = ctx.createRadialGradient(
    0,
    0,
    radiusPx * 0.1,
    0,
    0,
    radiusPx
  );
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(stop, withAlpha(color, 0.3 * fade + 0.06));
  gradient.addColorStop(1, withAlpha(color, 0.02));

  ctx.save();
  ctx.rotate(span.center);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radiusPx, -Math.PI / 2 - span.half, -Math.PI / 2 + span.half);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
};

/**
 * A car past the rim still matters — it is the one that woke the widget when
 * the activation range is wider than the scope. It keeps its bearing and parks
 * on the edge instead of vanishing.
 */
export const drawEdgeMarker = (
  ctx: CanvasRenderingContext2D,
  bearing: number,
  radiusPx: number
): void => {
  ctx.save();
  ctx.rotate(bearing);
  ctx.strokeStyle = EDGE_MARKER_INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    0,
    0,
    radiusPx - 3,
    -Math.PI / 2 - EDGE_MARKER_HALF_ANGLE_RAD,
    -Math.PI / 2 + EDGE_MARKER_HALF_ANGLE_RAD
  );
  ctx.stroke();
  ctx.restore();
};

interface CarInput {
  x: number;
  y: number;
  color: string;
  alpha: number;
  pxPerMeter: number;
  carLengthM: number;
}

export const drawCar = (
  ctx: CanvasRenderingContext2D,
  { x, y, color, alpha, pxPerMeter, carLengthM }: CarInput
): void => {
  const width = CAR_WIDTH_M * pxPerMeter;
  const height = carLengthM * pxPerMeter;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(
    x - width / 2,
    y - height / 2,
    width,
    height,
    CAR_CORNER_RADIUS_M * pxPerMeter
  );
  ctx.fill();
  ctx.restore();
};

/**
 * The label lives inside the body, so the body decides whether it fits: it
 * shrinks with the icon and switches itself off once it would spill over the
 * paintwork or drop below what a glance can read.
 */
export const drawBodyText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bodyColor: string,
  pxPerMeter: number,
  weight: 600 | 700 = 600
): void => {
  const fontPx = labelFontPx(pxPerMeter);

  if (fontPx < MIN_LABEL_PX) {
    return;
  }

  const available = CAR_WIDTH_M * pxPerMeter - LABEL_SIDE_PADDING_PX * 2;

  ctx.save();

  // A body 1.8 m wide is narrow at any sane widget size, so the label earns its
  // place by shrinking first — down to MIN_LABEL_PX, never past it.
  let size = fontPx;
  ctx.font = `${weight} ${size}px Rajdhani, sans-serif`;

  while (ctx.measureText(text).width > available && size > MIN_LABEL_PX) {
    size -= 1;
    ctx.font = `${weight} ${size}px Rajdhani, sans-serif`;
  }

  if (ctx.measureText(text).width > available) {
    ctx.restore();

    return;
  }

  ctx.fillStyle = readableOn(bodyColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
};

export const SCOPE_INK = {
  opponent: OPPONENT_INK,
  player: PLAYER_INK,
} as const;
