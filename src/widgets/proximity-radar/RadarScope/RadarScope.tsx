import { useWidgetInstanceId } from '@entities/layout/useWidgetSettings';
import { useLiveWidgetsStore } from '@entities/layout/live-widgets-context';
import { useLayoutEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import type { NearbyCar } from '@shared/contracts/bindings';
import type { BaseUserSettings } from '@shared/contracts/widget-settings';
import type { UnitSystem } from '@shared/contracts/domain';
import { formatDistance } from '@shared/lib/telemetry-format';
import { useReactiveCanvasLoop } from '@shared/hooks/useReactiveCanvasLoop';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useRadarWidgetStore } from '@entities/radar/radar-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  SIDE_LATERAL_OFFSET_M,
  resolveScopeScale,
} from '@entities/radar/radar-constants';
import {
  SCOPE_INK,
  beamPresence,
  carBearingSpan,
  collapseLaneRows,
  drawBeam,
  drawBodyText,
  drawCar,
  drawGrid,
  drawRimLabel,
  drawTexture,
  threatColorForGap,
  type BearingSpan,
} from '@entities/radar/radar-scope-utils';

import styles from './RadarScope.module.scss';
import type { ProximityRadarSettings } from '@entities/radar/radar.settings-schema';

/**
 * How far past the rim a car still leaves an edge marker, as a multiple of the
 * scope's radius. Beyond it the car is traffic, not a car about to come in, and
 * a mark on the rim would only crowd the ones that are.
 */
const EDGE_MARKER_REACH = 1.5;

export const RadarScope = observer(() => {
  // A ref would be null on the first render — the scope renders nothing until
  // there is traffic — and an effect keyed on a ref never learns that the
  // canvas arrived. State makes the mount itself the dependency.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const units = useUnitsStore();
  const appSettings = useAppSettingsStore();
  const session = useSessionStore();

  const computed = useBackendComputedStore();

  // Visibility comes from the radar store, not from the proximity frame:
  // reading the frame here is exactly what woke this component sixty times a
  // second.
  const visible = useRadarWidgetStore().isVisibleForWidget('proximity-radar');

  const liveWidgets = useLiveWidgetsStore();
  const instanceId = useWidgetInstanceId('proximity-radar');

  // Bumped by the observer below: a new size is the one reason to repaint that
  // no observable carries.
  const [sizeVersion, setSizeVersion] = useState(0);

  useLayoutEffect(() => {
    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(() =>
      setSizeVersion((version) => version + 1)
    );

    observer.observe(canvas);

    return () => observer.disconnect();
  }, [canvas]);

  // Paints when what it reads changes — the proximity frame on the overlay
  // clock, a setting, the roster, the units — or the size does, which rebuilds
  // the loop. It used to repaint on every animation frame, which kept the
  // overlay redrawing at the monitor's rate while the scope was up (ADR-0009).
  useReactiveCanvasLoop(
    (scheduleDraw) => {
      // oxlint-disable-next-line no-restricted-properties
      const allCars = computed.proximity?.nearbyCars ?? [];
      // Read here, not in the render, so the autorun tracks every one of them.
      const settings =
        liveWidgets.getSettings<ProximityRadarSettings>(instanceId);
      const scope = { ...settings };
      const { carLength } = appSettings.appSettings;
      const { unitSystem } = units;
      const carNumbers = session.carNumberByIdx;

      if (!canvas) {
        return;
      }

      scheduleDraw(() => {
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return;
        }

        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(canvas.clientWidth, canvas.clientHeight);

        if (size <= 0) {
          return;
        }

        if (canvas.width !== Math.round(size * dpr)) {
          canvas.width = Math.round(size * dpr);
          canvas.height = Math.round(size * dpr);
        }

        const radiusPx = size / 2;

        const { pxPerMeter, rangeMeters } = resolveScopeScale({
          scopeRange: scope.scopeRange,
          radiusPx,
        });

        // Cars past the marker reach cannot reach the picture, whatever they do.
        const nearbyCars = allCars.filter(
          (car) => car.clearance <= rangeMeters * EDGE_MARKER_REACH
        );

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.translate(radiusPx, radiusPx);
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radiusPx, 0, Math.PI * 2);
        ctx.clip();

        drawTexture(ctx, scope.backgroundTexture, radiusPx);
        drawGrid(ctx, {
          radiusPx,
          pxPerMeter,
          rangeMeters,
          carLengthM: carLength,
          unitSystem,
          fontScale: scope.fontScale,
          showAxes: scope.showAxes,
          showAxisLabels: scope.showAxisTicks,
          showRangeRings: scope.showRangeRings,
        });

        const lane: LaneContext = {
          radiusPx,
          pxPerMeter,
          rangeMeters,
          carLengthM: carLength,
          scope,
          carNumbers,
          unitSystem,
        };

        drawCenterLane(ctx, nearbyCars, lane);

        drawSideLane(ctx, nearbyCars, 'left', lane);
        drawSideLane(ctx, nearbyCars, 'right', lane);

        drawCar(ctx, {
          x: 0,
          y: 0,
          color: SCOPE_INK.player,
          alpha: scope.carOpacity,
          pxPerMeter,
          carLengthM: carLength,
        });

        ctx.restore();
      });
    },
    [
      canvas,
      computed,
      liveWidgets,
      instanceId,
      appSettings,
      units,
      session,
      sizeVersion,
    ]
  );

  if (!visible || !computed.hasProximity) {
    return null;
  }

  return (
    <canvas
      ref={setCanvas}
      className={styles.scope}
      aria-label="Proximity radar"
    />
  );
});

interface LaneContext {
  radiusPx: number;
  pxPerMeter: number;
  rangeMeters: number;
  carLengthM: number;
  scope: BaseUserSettings & ProximityRadarSettings;
  carNumbers: ReadonlyMap<number, string>;
  unitSystem: UnitSystem;
}

/**
 * The beam for a car in the scope and the edge marker for one past it are one
 * mark at two strengths, so a car crossing the rim grows its marker into a
 * beam instead of swapping one for the other.
 */
const drawTracking = (
  ctx: CanvasRenderingContext2D,
  lane: LaneContext,
  span: BearingSpan,
  distanceMeters: number,
  color: string
): void => {
  const { radiusPx, rangeMeters, scope } = lane;
  const inScope = distanceMeters <= rangeMeters;

  if (distanceMeters > rangeMeters * EDGE_MARKER_REACH) {
    return;
  }

  if (inScope ? !scope.showBeam : !scope.showEdgeMarkers) {
    return;
  }

  drawBeam(ctx, {
    span,
    presence: beamPresence(distanceMeters, rangeMeters),
    radiusPx,
    color,
    opacity: scope.beamOpacity,
    fill: inScope,
    edge: !inScope || scope.showBeamEdge,
  });
};

/**
 * A distance, written on the rim at the beam's own bearing so it turns with it.
 * The color is the beam's, so the number reads as part of the same mark.
 */
const drawGapLabel = (
  ctx: CanvasRenderingContext2D,
  lane: LaneContext,
  text: string,
  bearing: number,
  color: string
): void => {
  if (!lane.scope.showDistance) {
    return;
  }

  drawRimLabel(ctx, {
    text,
    bearing,
    radiusPx: lane.radiusPx,
    color,
    fontScale: lane.scope.fontScale,
  });
};

/**
 * How far a car alongside sits ahead or behind, center to center. Its bumper
 * gap is zero by definition — the bodies overlap — so the offset is the number
 * that still says something. No sign: the body and the beam already show which
 * way it is.
 */
const formatAlongsideOffset = (
  longitudinalMeters: number,
  unitSystem: UnitSystem
): string => formatDistance(Math.abs(longitudinalMeters), unitSystem);

/** An opponent's body and what is written on it — nothing when bodies are off. */
const drawOpponent = (
  ctx: CanvasRenderingContext2D,
  lane: LaneContext,
  position: { x: number; y: number },
  color: string,
  text: string | undefined
): void => {
  const { pxPerMeter, carLengthM, scope } = lane;

  if (!scope.showOpponentCars) {
    return;
  }

  drawCar(ctx, {
    ...position,
    color,
    alpha: scope.carOpacity,
    pxPerMeter,
    carLengthM,
  });

  if (text) {
    drawBodyText(ctx, {
      text,
      ...position,
      bodyColor: color,
      pxPerMeter,
      fontScale: scope.fontScale,
    });
  }
};

const nearestOf = (cars: NearbyCar[]): NearbyCar | undefined =>
  cars.reduce<NearbyCar | undefined>(
    (best, car) =>
      !best || Math.abs(car.longitudinalDist) < Math.abs(best.longitudinalDist)
        ? car
        : best,
    undefined
  );

/**
 * Ahead and behind. The gap the driver means is bumper to bumper, which the
 * backend already computes — the body is then placed a car length beyond it.
 * The gap itself is written at the beam's rim, for the nearest car each way
 * inside the circle.
 */
const drawCenterLane = (
  ctx: CanvasRenderingContext2D,
  cars: NearbyCar[],
  lane: LaneContext
): void => {
  const { pxPerMeter, rangeMeters, carLengthM, scope, carNumbers } = lane;
  const centerCars = cars.filter((car) => car.lateralSide === 'center');

  centerCars.forEach((car) => {
    const centerMeters = car.longitudinalDist;
    const threat = threatColorForGap(Math.abs(car.bumperDist));

    drawTracking(
      ctx,
      lane,
      carBearingSpan(0, centerMeters, carLengthM),
      Math.abs(centerMeters),
      threat
    );

    if (Math.abs(centerMeters) > rangeMeters) {
      return;
    }

    drawOpponent(
      ctx,
      lane,
      { x: 0, y: -centerMeters * pxPerMeter },
      scope.monochromeCars ? SCOPE_INK.opponent : threat,
      scope.showCarNumber ? carNumbers.get(car.carIdx) : undefined
    );
  });

  // Only a car the circle actually shows gets a number: one parked on the rim
  // as an edge marker can be most of the search radius away, and a gap the
  // scope cannot draw reads as if the car were right there.
  const shownCars = centerCars.filter(
    (car) => Math.abs(car.longitudinalDist) <= rangeMeters
  );
  const ahead = nearestOf(shownCars.filter((car) => car.longitudinalDist >= 0));
  const behind = nearestOf(shownCars.filter((car) => car.longitudinalDist < 0));

  [ahead, behind].forEach((car) => {
    if (!car) {
      return;
    }

    const gapMeters = Math.abs(car.bumperDist);

    drawGapLabel(
      ctx,
      lane,
      formatDistance(gapMeters, lane.unitSystem),
      carBearingSpan(0, car.longitudinalDist, carLengthM).center,
      threatColorForGap(gapMeters)
    );
  });
};

/**
 * Alongside. The sim reports a side and a longitudinal offset, never a lateral
 * position — so a queue is drawn along the lane and cars sharing a row become
 * one body carrying a count.
 */
const drawSideLane = (
  ctx: CanvasRenderingContext2D,
  cars: NearbyCar[],
  side: 'left' | 'right',
  lane: LaneContext
): void => {
  const { pxPerMeter, rangeMeters, carLengthM, scope, carNumbers } = lane;
  const lateral = SIDE_LATERAL_OFFSET_M * (side === 'left' ? -1 : 1);
  const sideCars = cars.filter((car) => car.lateralSide === side);

  if (sideCars.length === 0) {
    return;
  }

  const rows = collapseLaneRows(
    sideCars.map((car) => ({
      longitudinal: car.longitudinalDist,
      carIdx: car.carIdx,
    }))
  );
  const inScope = rows.filter(
    (row) => Math.hypot(lateral, row.longitudinal) <= rangeMeters
  );

  rows
    .filter((row) => !inScope.includes(row))
    .forEach((row) => {
      drawTracking(
        ctx,
        lane,
        carBearingSpan(lateral, row.longitudinal, carLengthM),
        Math.hypot(lateral, row.longitudinal),
        threatColorForGap(Math.abs(row.longitudinal))
      );
    });

  if (inScope.length === 0) {
    return;
  }

  const spans = inScope.map((row) =>
    carBearingSpan(lateral, row.longitudinal, carLengthM)
  );

  const low = Math.min(...spans.map((span) => span.center - span.half));
  const high = Math.max(...spans.map((span) => span.center + span.half));
  const beamSpan = { center: (low + high) / 2, half: (high - low) / 2 };

  const nearest = inScope.reduce((best, row) =>
    Math.abs(row.longitudinal) < Math.abs(best.longitudinal) ? row : best
  );

  // Side by side is dangerous long before the gap is, so the overlap itself is
  // the threat: zero means door to door.
  const threat = threatColorForGap(Math.abs(nearest.longitudinal));

  drawTracking(
    ctx,
    lane,
    beamSpan,
    Math.hypot(lateral, nearest.longitudinal),
    threat
  );

  drawGapLabel(
    ctx,
    lane,
    formatAlongsideOffset(nearest.longitudinal, lane.unitSystem),
    beamSpan.center,
    threat
  );

  const x = lateral * pxPerMeter;

  inScope.forEach((row) => {
    const label =
      row.count > 1
        ? `×${row.count}`
        : scope.showCarNumber
          ? carNumbers.get(row.carIdx)
          : undefined;

    drawOpponent(
      ctx,
      lane,
      { x, y: -row.longitudinal * pxPerMeter },
      scope.monochromeCars
        ? SCOPE_INK.opponent
        : threatColorForGap(Math.abs(row.longitudinal)),
      label
    );
  });
};
