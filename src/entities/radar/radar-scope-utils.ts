import type { UnitSystem } from '@shared/contracts/domain';
import {
  fillFixedDigits,
  measureFixedDigits,
  strokeFixedDigits,
} from '@shared/lib/canvas';
import {
  displayDistanceToMeters,
  metersToDisplayDistance,
  widgetDistanceUnit,
} from '@shared/lib/telemetry-format';

import type { RadarBackgroundTexture } from './radar.settings-schema';

/** Average car body width in meters — the icon is the footprint, not a dot. */
export const CAR_WIDTH_M = 1.8;

/** Corner rounding of the car icon, in meters of body. */
export const CAR_CORNER_RADIUS_M = 0.35;

/** Two cars closer than this along the lane read as one row, not a queue. */
export const SAME_ROW_M = 2.5;

/** Padding around the body's own angular footprint, in radians. */
const BEAM_PADDING_RAD = (2 * Math.PI) / 180;

/** Smallest legible in-body label and the room it needs around it. */
const MIN_LABEL_PX = 8;
const MAX_LABEL_PX = 13;
const LABEL_SIDE_PADDING_PX = 2;
const LABEL_PX_PER_METER = 1.3;

const AXIS_GAP_M = 1.4;
/** Dash and gap of the vertical axis, and of the finer lateral one, in px. */
const LONGITUDINAL_AXIS_DASH_PX = [12, 3];
const LATERAL_AXIS_DASH_PX = [1.5, 2.5];
/** The lateral axis and the range ring share one fine line: both only frame. */
const FINE_LINE_WIDTH_PX = 0.5;
const TEXTURE_RING_COUNT = 5;
const TEXTURE_DOTS_PER_RING = 8;
const TEXTURE_MESH_STEP_DEG = 15;
const TEXTURE_HATCH_STEP_PX = 7;
/** The ink every texture is drawn with — a wash, not a user-tuned dial. */
const TEXTURE_ALPHA = 0.02;
const TEXTURE_SCANLINE_STEP_PX = 4;

/** Axis labels per half axis the step aims for, and the steps it picks from. */
const AXIS_LABELS_PER_HALF = 2.5;
const AXIS_LABEL_STEPS = [1, 2, 2.5, 5, 10, 15, 20, 25, 50, 100];
/** Axis label size as a share of the scope radius, and its floor. */
const AXIS_LABEL_RADIUS_SHARE = 0.11;
const MIN_AXIS_LABEL_PX = 8;
/** Room between an axis label and the axis it cuts, in px. */
const AXIS_LABEL_GAP_PX = 2;
/** A label closer to the rim than this many font sizes would be cut by it. */
const AXIS_LABEL_RIM_CLEARANCE = 1.2;

const GRID_INK = 'rgba(250, 250, 250, 0.12)';
const AXIS_LABEL_INK = 'rgba(250, 250, 250, 0.45)';
const OPPONENT_INK = 'rgba(250, 250, 250, 0.82)';
const PLAYER_INK = 'rgba(250, 250, 250, 0.9)';
const LABEL_ON_LIGHT = 'rgba(8, 9, 10, 0.92)';
const LABEL_ON_DARK = 'rgba(250, 250, 250, 0.92)';
const RIM_LABEL_OUTLINE = 'rgba(0, 0, 0, 0.9)';
/** Numbers and counts on a body are read at a glance, so they are bold. */
const BODY_TEXT_WEIGHT = 700;

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

export interface LaneCar {
  /** Signed offset along the lane, positive ahead. */
  longitudinal: number;
  carIdx: number;
}

export interface LaneRow {
  /** Signed offset along the lane, positive ahead. */
  longitudinal: number;
  /** How many cars share this row — drawn as one body and a `×N`. */
  count: number;
  /** The row's nearest car — the one whose number a single body carries. */
  carIdx: number;
}

/**
 * Cars alongside, collapsed into rows. The sim gives a longitudinal offset per
 * car and no lateral one, so a queue is drawn where it really is along the lane
 * and an actual row becomes one icon with a count rather than an invented
 * second column.
 */
export const collapseLaneRows = (cars: LaneCar[]): LaneRow[] => {
  const rows: LaneRow[] = [];

  [...cars]
    .sort(
      (first, second) =>
        Math.abs(first.longitudinal) - Math.abs(second.longitudinal)
    )
    .forEach((car) => {
      const existing = rows.find(
        (row) => Math.abs(row.longitudinal - car.longitudinal) < SAME_ROW_M
      );

      if (existing) {
        existing.count += 1;

        return;
      }

      rows.push({
        longitudinal: car.longitudinal,
        count: 1,
        carIdx: car.carIdx,
      });
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
  unitSystem: UnitSystem;
  /** The widget's text size setting, applied to the axis labels. */
  fontScale: number;
  showAxes: boolean;
  showAxisLabels: boolean;
  showRangeRings: boolean;
}

/**
 * Step between axis labels, in the unit the driver reads — a round number of
 * meters or of feet, never a converted one: `16.4ft` is not a scale.
 */
export const axisLabelStep = (
  rangeMeters: number,
  unitSystem: UnitSystem
): number => {
  const wanted =
    metersToDisplayDistance(rangeMeters, unitSystem) / AXIS_LABELS_PER_HALF;

  return (
    AXIS_LABEL_STEPS.find((step) => step >= wanted) ??
    AXIS_LABEL_STEPS[AXIS_LABEL_STEPS.length - 1]
  );
};

export const axisLabelText = (value: number, unitSystem: UnitSystem): string =>
  `${value}${widgetDistanceUnit(unitSystem)}`;

interface AxisLabel {
  text: string;
  /** Distance from the centre along the axis, in px. */
  offsetPx: number;
  /** Half the room the label keeps clear across the axis, gap included. */
  halfWidthPx: number;
}

const axisLabelsFor = (
  ctx: CanvasRenderingContext2D,
  radiusPx: number,
  pxPerMeter: number,
  rangeMeters: number,
  unitSystem: UnitSystem,
  fontPx: number
): AxisLabel[] => {
  const step = axisLabelStep(rangeMeters, unitSystem);
  const reachPx = radiusPx - fontPx * AXIS_LABEL_RIM_CLEARANCE;
  const labels: AxisLabel[] = [];

  for (
    let value = step;
    displayDistanceToMeters(value, unitSystem) * pxPerMeter <= reachPx;
    value += step
  ) {
    const text = axisLabelText(value, unitSystem);

    labels.push({
      text,
      offsetPx: displayDistanceToMeters(value, unitSystem) * pxPerMeter,
      halfWidthPx: ctx.measureText(text).width / 2 + AXIS_LABEL_GAP_PX,
    });
  }

  return labels;
};

/**
 * One half of the vertical axis, from `fromPx` to `toPx` away from the centre
 * on the side `direction` picks, cut where a label stands — the number sits in
 * the axis, as the G-meter's sit in its rings, rather than beside it.
 */
const traceAxisAround = (
  ctx: CanvasRenderingContext2D,
  fromPx: number,
  toPx: number,
  direction: 1 | -1,
  labels: AxisLabel[],
  halfCutPx: number
): void => {
  let cursor = fromPx;

  labels
    .filter((label) => label.offsetPx > fromPx && label.offsetPx < toPx)
    .forEach((label) => {
      const cutStart = label.offsetPx - halfCutPx;

      if (cutStart > cursor) {
        ctx.moveTo(0, cursor * direction);
        ctx.lineTo(0, cutStart * direction);
      }

      cursor = Math.max(cursor, label.offsetPx + halfCutPx);
    });

  if (cursor < toPx) {
    ctx.moveTo(0, cursor * direction);
    ctx.lineTo(0, toPx * direction);
  }
};

interface ArcCut {
  start: number;
  end: number;
}

/**
 * Where a ring passes through the labels on the vertical axis, as angle
 * ranges: a label straddling the ring takes the arc under it, top and bottom.
 */
const ringCutsFor = (
  ringPx: number,
  labels: AxisLabel[],
  halfHeightPx: number
): ArcCut[] =>
  labels
    .filter((label) => Math.abs(ringPx - label.offsetPx) <= halfHeightPx)
    .flatMap((label) => {
      const half = Math.asin(Math.min(1, label.halfWidthPx / ringPx));

      return [-Math.PI / 2, Math.PI / 2].map((center) => ({
        start: center - half,
        end: center + half,
      }));
    })
    .sort((first, second) => first.start - second.start);

/** A full ring, less the arcs the cuts take out of it. */
const traceRingAround = (
  ctx: CanvasRenderingContext2D,
  ringPx: number,
  cuts: ArcCut[]
): void => {
  if (cuts.length === 0) {
    ctx.moveTo(ringPx, 0);
    ctx.arc(0, 0, ringPx, 0, Math.PI * 2);

    return;
  }

  // Walk once round from the end of the last cut, so the arc that crosses the
  // zero angle is drawn in one piece.
  const lastEnd = cuts[cuts.length - 1].end;
  let cursor = lastEnd - Math.PI * 2;

  cuts.forEach((cut) => {
    if (cut.start > cursor) {
      ctx.moveTo(Math.cos(cursor) * ringPx, Math.sin(cursor) * ringPx);
      ctx.arc(0, 0, ringPx, cursor, cut.start);
    }

    cursor = Math.max(cursor, cut.end);
  });
};

/**
 * Rings and axes, never a lateral scale: the sim measures along the track and
 * nothing across it, so the distances are written on the vertical axis alone.
 * The axis and the ring both break where a distance is written, so no line
 * runs through a number.
 */
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  {
    radiusPx,
    pxPerMeter,
    rangeMeters,
    carLengthM,
    unitSystem,
    fontScale,
    showAxes,
    showAxisLabels,
    showRangeRings,
  }: GridInput
): void => {
  const fontPx = Math.max(
    MIN_AXIS_LABEL_PX,
    Math.round(radiusPx * AXIS_LABEL_RADIUS_SHARE * fontScale)
  );

  ctx.save();
  ctx.font = `600 ${fontPx}px Rajdhani, sans-serif`;

  const labels =
    showAxes && showAxisLabels
      ? axisLabelsFor(
          ctx,
          radiusPx,
          pxPerMeter,
          rangeMeters,
          unitSystem,
          fontPx
        )
      : [];
  const halfHeightPx = fontPx / 2 + AXIS_LABEL_GAP_PX;

  ctx.strokeStyle = GRID_INK;

  if (showRangeRings) {
    ctx.lineWidth = FINE_LINE_WIDTH_PX;
    ctx.setLineDash(LATERAL_AXIS_DASH_PX);
    ctx.beginPath();

    rangeRingRadii(rangeMeters).forEach((meters) => {
      const ringPx = meters * pxPerMeter;

      traceRingAround(ctx, ringPx, ringCutsFor(ringPx, labels, halfHeightPx));
    });

    ctx.stroke();
  }

  if (!showAxes) {
    ctx.restore();

    return;
  }

  const lateralGap = AXIS_GAP_M * pxPerMeter;
  const bodyGap = (carLengthM / 2) * pxPerMeter + 4;

  // The lateral axis is only a reference — the sim measures nothing across
  // the track — so it is the faintest line on the scope.
  ctx.lineWidth = FINE_LINE_WIDTH_PX;
  ctx.setLineDash(LATERAL_AXIS_DASH_PX);
  ctx.beginPath();
  ctx.moveTo(-radiusPx, 0);
  ctx.lineTo(-lateralGap, 0);
  ctx.moveTo(lateralGap, 0);
  ctx.lineTo(radiusPx, 0);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.setLineDash(LONGITUDINAL_AXIS_DASH_PX);
  ctx.beginPath();
  traceAxisAround(ctx, bodyGap, radiusPx, -1, labels, halfHeightPx);
  traceAxisAround(ctx, bodyGap, radiusPx, 1, labels, halfHeightPx);
  ctx.stroke();
  ctx.setLineDash([]);

  if (labels.length > 0) {
    ctx.fillStyle = AXIS_LABEL_INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((label) => {
      ctx.fillText(label.text, 0, -label.offsetPx);
      ctx.fillText(label.text, 0, label.offsetPx);
    });
  }

  ctx.restore();
};

/**
 * Half the scope — the one ring left. The rim is the plate's own border, and a
 * second line drawn on top of it only thickened it.
 */
export const rangeRingRadii = (rangeMeters: number): number[] => [
  rangeMeters / 2,
];

interface BeamInput {
  span: BearingSpan;
  /** How far into the scope the car is: 0 on the rim or past it, 1 well in. */
  presence: number;
  radiusPx: number;
  color: string;
  /** The beam's alpha at the rim once the car is well inside. */
  opacity: number;
  /** Paint the sector, or only its rim line — the edge marker. */
  fill: boolean;
  /** Close the sector with a line on the rim. Always on for a bare marker. */
  edge: boolean;
}

/** Narrowest the rim line gets, so a car far out still leaves a mark. */
const MIN_BEAM_HALF_RAD = 0.07;

/**
 * Share of the range a car travels inside the rim before its beam is fully
 * up: the marker grows into the beam over this stretch rather than popping.
 */
const BEAM_RAMP_SHARE = 0.35;

/** The rim line's alpha against the beam's, and what it keeps on the edge. */
const RIM_LINE_GAIN = 2.5;
const RIM_LINE_FLOOR = 0.6;
const RIM_LINE_WIDTH_PX = 2;

/** Where the beam's wash starts, as a share of the radius from the centre. */
const BEAM_WASH_START = 0.1;

/**
 * 0 while the car is on or beyond the rim, rising to 1 once it is a ramp's
 * length inside — the edge marker turning into the beam.
 */
export const beamPresence = (
  distanceMeters: number,
  rangeMeters: number
): number =>
  Math.min(
    1,
    Math.max(
      0,
      (rangeMeters - distanceMeters) / (rangeMeters * BEAM_RAMP_SHARE)
    )
  );

/**
 * The sector that follows an opponent, and the arc that closes it on the rim.
 * The wash is clear at our car and densest at the rim, so the scope around us
 * stays readable; the arc is the beam's edge and fades with it. A car past the
 * rim keeps only the arc — that is the edge marker, the same mark the beam
 * grows out of as the car comes in.
 */
export const drawBeam = (
  ctx: CanvasRenderingContext2D,
  { span, presence, radiusPx, color, opacity, fill, edge }: BeamInput
): void => {
  const half = Math.max(span.half, MIN_BEAM_HALF_RAD);
  const start = -Math.PI / 2 - half;
  const end = -Math.PI / 2 + half;

  ctx.save();
  ctx.rotate(span.center);

  if (fill && presence > 0) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusPx);

    gradient.addColorStop(BEAM_WASH_START, withAlpha(color, 0));
    gradient.addColorStop(1, withAlpha(color, opacity * presence));

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radiusPx, start, end);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  if (!edge) {
    ctx.restore();

    return;
  }

  const lineAlpha =
    Math.min(1, opacity * RIM_LINE_GAIN) *
    (RIM_LINE_FLOOR + (1 - RIM_LINE_FLOOR) * presence);

  ctx.strokeStyle = withAlpha(color, lineAlpha);
  ctx.lineWidth = RIM_LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx - RIM_LINE_WIDTH_PX / 2, start, end);
  ctx.stroke();
  ctx.restore();
};

/** Rim label size as a share of the scope radius, and its floor. */
const RIM_LABEL_RADIUS_SHARE = 0.19;
const MIN_RIM_LABEL_PX = 11;
const RIM_LABEL_INSET_PX = 1;
const RIM_LABEL_OUTLINE_PX = 1.5;

interface RimLabelInput {
  text: string;
  /** The beam's own bearing, so the label turns with it. */
  bearing: number;
  radiusPx: number;
  color: string;
  fontScale: number;
}

/**
 * How far out along `bearing` an upright label can sit and keep the same gap
 * to the rim whichever way the beam points. The text does not turn with the
 * beam, so at the top and bottom its height faces the rim and on the sides its
 * width — the inset is the label's own extent in the beam's direction.
 */
export const labelDistanceInside = (
  limitPx: number,
  bearing: number,
  halfWidthPx: number,
  halfHeightPx: number
): number =>
  Math.max(
    0,
    limitPx -
      Math.abs(Math.sin(bearing)) * halfWidthPx -
      Math.abs(Math.cos(bearing)) * halfHeightPx
  );

/**
 * A distance written at the beam's edge, just inside the rim on the beam's
 * bearing, in the beam's color — outlined in black, since it sits over the
 * wash, the plate and whatever the stream shows through it.
 */
export const drawRimLabel = (
  ctx: CanvasRenderingContext2D,
  { text, bearing, radiusPx, color, fontScale }: RimLabelInput
): void => {
  const fontPx = Math.max(
    MIN_RIM_LABEL_PX,
    Math.round(radiusPx * RIM_LABEL_RADIUS_SHARE * fontScale)
  );

  ctx.save();
  ctx.font = `700 ${fontPx}px Rajdhani, sans-serif`;

  const distancePx = labelDistanceInside(
    radiusPx - RIM_LINE_WIDTH_PX - RIM_LABEL_INSET_PX,
    bearing,
    measureFixedDigits(ctx, text) / 2 + RIM_LABEL_OUTLINE_PX,
    fontPx / 2 + RIM_LABEL_OUTLINE_PX
  );
  const x = Math.sin(bearing) * distancePx;
  const y = -Math.cos(bearing) * distancePx;

  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = RIM_LABEL_OUTLINE_PX;
  ctx.strokeStyle = RIM_LABEL_OUTLINE;
  strokeFixedDigits(ctx, text, x, y);
  ctx.fillStyle = color;
  fillFixedDigits(ctx, text, x, y);
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
interface BodyTextInput {
  text: string;
  x: number;
  y: number;
  bodyColor: string;
  pxPerMeter: number;
  /** The widget's text size setting; the body's width still caps the label. */
  fontScale: number;
}

export const drawBodyText = (
  ctx: CanvasRenderingContext2D,
  { text, x, y, bodyColor, pxPerMeter, fontScale }: BodyTextInput
): void => {
  const fontPx = Math.round(labelFontPx(pxPerMeter) * fontScale);
  const weight = BODY_TEXT_WEIGHT;

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
