/** How fast the wave moves, in phase units a second. */
const PHASE_PER_SECOND = 0.55;
/** The longest step one frame may take, so the wave resumes where it paused. */
const MAX_FRAME_SECONDS = 0.05;
/** How quickly the colour follows the sim's state; about a second to settle. */
const LIVENESS_RATE = 3;

export type WaveClock = {
  /** Where the wave is in its motion; grows only while someone watches. */
  phase: number;
  /** 0 grey (sim not connected) … 1 full colour (connected). */
  liveness: number;
};

export type WaveConditions = {
  /** The window is focused and not minimised. */
  isWatched: boolean;
  isConnected: boolean;
};

export const INITIAL_WAVE_CLOCK: WaveClock = { phase: 0, liveness: 0 };

type Rgb = [number, number, number];

/** The colour every line has while the sim is not connected. */
const REST_GREY: Rgb = [224, 224, 224];
/** How far above the header's bottom the wave rests, in px. */
const BASELINE_OFFSET = 3;
/** Points per line across the header. */
const POINTS_PER_LINE = 160;
/** Over how many px the wave flattens into its baseline at either end. */
const EDGE_TAPER = 40;

type LineSpec = {
  /** Phase offset from the first line, so the three never coincide. */
  offset: number;
  /** Opacity at rest, and what connecting adds to it. */
  restAlpha: number;
  liveAlphaGain: number;
  lineWidth: number;
  /** How high the bumps lift this line, in px. */
  dome: number;
  liveRgb: Rgb;
  /** Under-fill opacity at rest, and what connecting adds; 0 for no fill. */
  restFillAlpha: number;
  liveFillAlphaGain: number;
};

const LINE_SPECS: LineSpec[] = [
  {
    offset: 0,
    restAlpha: 0.16,
    liveAlphaGain: 0.26,
    lineWidth: 1,
    dome: 9,
    liveRgb: [255, 96, 64],
    restFillAlpha: 0.035,
    liveFillAlphaGain: 0.025,
  },
  {
    offset: 1.3,
    restAlpha: 0.08,
    liveAlphaGain: 0.2,
    lineWidth: 0.8,
    dome: 6,
    liveRgb: [64, 220, 140],
    restFillAlpha: 0,
    liveFillAlphaGain: 0,
  },
  {
    offset: 2.6,
    restAlpha: 0.05,
    liveAlphaGain: 0.17,
    lineWidth: 0.7,
    dome: 4,
    liveRgb: [80, 170, 255],
    restFillAlpha: 0,
    liveFillAlphaGain: 0,
  },
];

type BumpSpec = {
  /** How far either side of the header's middle it wanders, as a share of the width. */
  reach: number;
  /** How fast it wanders, per unit of phase. */
  rate: number;
  /** Where in its wandering it starts. */
  startAngle: number;
  /** Its height relative to a line's dome. */
  height: number;
  /** Its spread, in px. */
  spread: number;
};

/** Two bumps that drift along the header on their own slow cycles. */
const BUMP_SPECS: BumpSpec[] = [
  { reach: 0.38, rate: 0.11, startAngle: 0, height: 1, spread: 80 },
  { reach: 0.42, rate: 0.07, startAngle: 2.1, height: 0.4, spread: 110 },
];

type Bump = { centre: number; height: number; spread: number };

const HEADER_MIDDLE = 0.5;

const bumpsAt = (phase: number): Bump[] =>
  BUMP_SPECS.map((spec) => ({
    centre:
      HEADER_MIDDLE +
      spec.reach * Math.sin(phase * spec.rate + spec.startAngle),
    height: spec.height,
    spread: spec.spread,
  }));

/** How much the bumps breathe up and down, in px, and how fast. */
const DOME_BREATH = 0.8;
const DOME_BREATH_RATE = 0.8;
/** How far each line's bump sits right of the one before, in px. */
const BUMP_STAGGER = 6;

type RippleSpec = {
  /** Its height, in px. */
  height: number;
  /** Waves per px across the header. */
  density: number;
  /** How fast it runs, per unit of phase; the sign is its direction. */
  rate: number;
  shape: (angle: number) => number;
};

/** Two ripples running along the line under the bumps. */
const RIPPLES: RippleSpec[] = [
  { height: 1.6, density: 0.012, rate: -1, shape: Math.sin },
  { height: 0.8, density: 0.027, rate: 0.7, shape: Math.cos },
];

const gaussian = (value: number, centre: number, spread: number) => {
  const distance = (value - centre) / spread;

  return Math.exp(-(distance * distance) / 2);
};

const mixRgb = (from: Rgb, to: Rgb, share: number): Rgb =>
  from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * share)
  ) as Rgb;

export type WavePoint = { x: number; y: number };

export type WaveLine = {
  points: WavePoint[];
  rgb: Rgb;
  /** Opacity at the line's brightest point. */
  alpha: number;
  lineWidth: number;
  /** Opacity of the fill under the line at the header's bottom; 0 for none. */
  fillAlpha: number;
  /** Where the line is brightest: over the main bump, as a share of the width. */
  peakShare: number;
};

export type WaveFrame = {
  width: number;
  height: number;
  phase: number;
  liveness: number;
};

/**
 * The header wave's three lines for one frame: calm ripples along the bottom
 * of the header, lifted by two wandering bumps, grey at rest and coloured
 * once the sim connects.
 */
export const waveLines = ({
  width,
  height,
  phase,
  liveness,
}: WaveFrame): WaveLine[] => {
  const bumps = bumpsAt(phase);
  const baseline = height - BASELINE_OFFSET;

  return LINE_SPECS.map((spec, lineIndex) => {
    const points: WavePoint[] = [];
    const dome =
      spec.dome + Math.sin(phase * DOME_BREATH_RATE + lineIndex) * DOME_BREATH;

    for (let pointIndex = 0; pointIndex <= POINTS_PER_LINE; pointIndex++) {
      const x = (pointIndex / POINTS_PER_LINE) * width;
      const taper = Math.min(1, x / EDGE_TAPER, (width - x) / EDGE_TAPER);
      let lift = 0;

      for (const ripple of RIPPLES) {
        lift +=
          ripple.shape(x * ripple.density + phase * ripple.rate + spec.offset) *
          ripple.height;
      }

      for (const bump of bumps) {
        lift +=
          dome *
          bump.height *
          gaussian(
            x,
            bump.centre * width + lineIndex * BUMP_STAGGER,
            bump.spread
          );
      }

      points.push({ x, y: baseline - lift * taper });
    }

    return {
      points,
      rgb: mixRgb(REST_GREY, spec.liveRgb, liveness),
      alpha: spec.restAlpha + spec.liveAlphaGain * liveness,
      lineWidth: spec.lineWidth,
      fillAlpha: spec.restFillAlpha + spec.liveFillAlphaGain * liveness,
      peakShare: bumps[0].centre,
    };
  });
};

/** The wave one frame later, `elapsedSeconds` after the last. */
export const advanceWaveClock = (
  clock: WaveClock,
  elapsedSeconds: number,
  conditions: WaveConditions
): WaveClock => {
  const targetLiveness = conditions.isConnected ? 1 : 0;

  // A held frame has no fade to play: it shows the state as it is.
  if (!conditions.isWatched) {
    return { phase: clock.phase, liveness: targetLiveness };
  }

  // A first frame can carry a timestamp from just before the loop started.
  const stepSeconds = Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsedSeconds));
  const easing = Math.min(1, stepSeconds * LIVENESS_RATE);

  return {
    phase: clock.phase + stepSeconds * PHASE_PER_SECOND,
    liveness: clock.liveness + (targetLiveness - clock.liveness) * easing,
  };
};
