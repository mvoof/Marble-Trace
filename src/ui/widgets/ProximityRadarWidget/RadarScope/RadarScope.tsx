import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import type { NearbyCar } from '@/types/bindings';
import type { UnitSystem } from '@/types';
import type { ProximityRadarSettings } from '@/types/widget-settings';
import { formatDistance } from '@utils/telemetry-format';
import {
  useAppSettingsStore,
  useBackendComputedStore,
  useRadarWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';
import {
  DESIGN_SIZE_PX,
  SIDE_LATERAL_OFFSET_M,
  resolveScopeScale,
} from '@utils/radar-constants';
import {
  SCOPE_INK,
  carBearingSpan,
  collapseLaneRows,
  drawBeam,
  drawBodyText,
  drawCar,
  drawEdgeMarker,
  drawGrid,
  drawTexture,
  threatColorForGap,
} from '../radar-scope-utils';

import styles from './RadarScope.module.scss';

/**
 * Cars further out than this never reach the scope whatever the user sets, and
 * fetching them costs the widget nothing it can draw.
 */
const SEARCH_RADIUS_M = 40;

export const RadarScope = observer(() => {
  // A ref would be null on the first render — the scope renders nothing until
  // there is traffic — and an effect keyed on a ref never learns that the
  // canvas arrived. State makes the mount itself the dependency.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const units = useUnitsStore();
  const appSettings = useAppSettingsStore();

  const computed = useBackendComputedStore();

  // Deliberately not `useProximityRadarData`: that hook reads the proximity
  // frame to build its car list, and reading it here is exactly what woke this
  // component sixty times a second.
  const visible = useRadarWidgetStore().isVisibleForWidget('proximity-radar');

  // The cars are read inside the draw loop instead of here. The loop repaints on
  // every animation frame regardless, so reading the frame in the render body
  // would buy nothing and would wake React sixty times a second — the whole of
  // this widget's debt. See `docs/rendering.md`.
  const carsRef = useRef({
    carLength: appSettings.appSettings.carLength,
  });

  const settings = useWidgetSettings<ProximityRadarSettings>('proximity-radar');

  const settingsRef = useRef(settings);
  const unitSystemRef = useRef(units.unitSystem);

  // Written after the render rather than during it: a render body that mutates
  // a ref is not replayable, and the draw loop only ever reads them on the next
  // frame anyway. No dependency list — every render carries a newer tick.
  useLayoutEffect(() => {
    carsRef.current = {
      carLength: appSettings.appSettings.carLength,
    };
    settingsRef.current = settings;
    unitSystemRef.current = units.unitSystem;
  });

  useLayoutEffect(() => {
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(canvas.clientWidth, canvas.clientHeight);

      if (size <= 0) {
        return;
      }

      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
      }

      const scope = settingsRef.current;
      const { carLength } = carsRef.current;
      // Inside a hand-rolled RAF loop (not useReactiveCanvasLoop), same escape
      // hatch without the shared primitive's grep signal. See docs/rendering.md.
      const nearbyCars =
        // oxlint-disable-next-line no-restricted-properties
        computed.proximity?.nearbyCars.filter(
          (car) => car.clearance <= SEARCH_RADIUS_M
        ) ?? [];
      const radiusPx = size / 2;

      const { pxPerMeter, rangeMeters } = resolveScopeScale({
        scaleMode: scope.scaleMode,
        scopeRange: scope.scopeRange,
        radiusPx,
        widgetScale: size / DESIGN_SIZE_PX,
      });

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
        showAxes: scope.showAxes,
        showAxisTicks: scope.showAxisTicks,
        showRangeRings: scope.showRangeRings,
      });

      const geometry = {
        radiusPx,
        pxPerMeter,
        rangeMeters,
        carLengthM: carLength,
      };

      drawCenterLane(ctx, nearbyCars, geometry, scope, unitSystemRef.current);

      drawSideLane(ctx, nearbyCars, 'left', geometry, scope);
      drawSideLane(ctx, nearbyCars, 'right', geometry, scope);

      drawCar(ctx, {
        x: 0,
        y: 0,
        color: SCOPE_INK.player,
        alpha: scope.carOpacity,
        pxPerMeter,
        carLengthM: carLength,
      });

      ctx.restore();
    };

    frame = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frame);
  }, [canvas, computed]);

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

interface ScopeGeometry {
  radiusPx: number;
  pxPerMeter: number;
  rangeMeters: number;
  carLengthM: number;
}

/**
 * Ahead and behind. The gap the driver means is bumper to bumper, which the
 * backend already computes — the body is then placed a car length beyond it.
 */
const drawCenterLane = (
  ctx: CanvasRenderingContext2D,
  cars: NearbyCar[],
  geometry: ScopeGeometry,
  scope: ProximityRadarSettings,
  unitSystem: UnitSystem
): void => {
  const { radiusPx, pxPerMeter, rangeMeters, carLengthM } = geometry;

  cars
    .filter((car) => car.lateralSide === 'center')
    .forEach((car) => {
      const centerMeters = car.longitudinalDist;
      const gapMeters = Math.abs(car.bumperDist);

      if (Math.abs(centerMeters) > rangeMeters) {
        if (scope.showEdgeMarkers) {
          drawEdgeMarker(ctx, centerMeters >= 0 ? 0 : Math.PI, radiusPx);
        }

        return;
      }

      const threat = threatColorForGap(gapMeters);
      const body = scope.monochromeCars ? SCOPE_INK.opponent : threat;

      if (scope.showBeam) {
        drawBeam(ctx, {
          span: carBearingSpan(0, centerMeters, carLengthM),
          distanceMeters: Math.abs(centerMeters),
          rangeMeters,
          pxPerMeter,
          radiusPx,
          color: threat,
          opacity: scope.beamOpacity,
        });
      }

      const y = -centerMeters * pxPerMeter;

      drawCar(ctx, {
        x: 0,
        y,
        color: body,
        alpha: scope.carOpacity,
        pxPerMeter,
        carLengthM,
      });

      if (scope.showDistance) {
        drawBodyText(
          ctx,
          formatDistance(gapMeters, unitSystem),
          0,
          y,
          body,
          pxPerMeter
        );
      }
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
  geometry: ScopeGeometry,
  scope: ProximityRadarSettings
): void => {
  const { radiusPx, pxPerMeter, rangeMeters, carLengthM } = geometry;
  const lateral = SIDE_LATERAL_OFFSET_M * (side === 'left' ? -1 : 1);

  const offsets = cars
    .filter((car) => car.lateralSide === side)
    .map((car) => car.longitudinalDist);

  if (offsets.length === 0) {
    return;
  }

  const rows = collapseLaneRows(offsets);
  const inScope = rows.filter(
    (row) => Math.hypot(lateral, row.longitudinal) <= rangeMeters
  );

  if (scope.showEdgeMarkers) {
    rows
      .filter((row) => !inScope.includes(row))
      .forEach((row) => {
        drawEdgeMarker(ctx, Math.atan2(lateral, row.longitudinal), radiusPx);
      });
  }

  if (inScope.length === 0) {
    return;
  }

  const spans = inScope.map((row) =>
    carBearingSpan(lateral, row.longitudinal, carLengthM)
  );

  const low = Math.min(...spans.map((span) => span.center - span.half));
  const high = Math.max(...spans.map((span) => span.center + span.half));

  const nearest = inScope.reduce((best, row) =>
    Math.abs(row.longitudinal) < Math.abs(best.longitudinal) ? row : best
  );

  // Side by side is dangerous long before the gap is, so the overlap itself is
  // the threat: zero means door to door.
  const threat = threatColorForGap(Math.abs(nearest.longitudinal));

  if (scope.showBeam) {
    drawBeam(ctx, {
      span: { center: (low + high) / 2, half: (high - low) / 2 },
      distanceMeters: Math.hypot(lateral, nearest.longitudinal),
      rangeMeters,
      pxPerMeter,
      radiusPx,
      color: threat,
      opacity: scope.beamOpacity,
    });
  }

  const x = lateral * pxPerMeter;

  inScope.forEach((row) => {
    const y = -row.longitudinal * pxPerMeter;

    const body = scope.monochromeCars
      ? SCOPE_INK.opponent
      : threatColorForGap(Math.abs(row.longitudinal));

    drawCar(ctx, {
      x,
      y,
      color: body,
      alpha: scope.carOpacity,
      pxPerMeter,
      carLengthM,
    });

    if (row.count > 1) {
      drawBodyText(ctx, `×${row.count}`, x, y, body, pxPerMeter, 700);
    }
  });
};
