/**
 * Marble Trace Site - Lap analysis
 *
 * The app's Analysis tab, working, on two real laps of one session
 * (src/data/analysis-laps.json, read out of the app's stats.db on a 5 m
 * grid). It copies the tab rather than describing it: the same stacked
 * distance charts (src/pages/analysis, shared/ui/LapChart) with a y axis, the
 * sectors shaded every other one, one dashed cursor through every chart and a
 * plaque beside it; the same gestures (wheel to zoom, drag to pan, Shift +
 * drag to frame, double click for the whole lap); the same map, a grey band
 * with sector ticks, each lap faint outside the charts' stretch and bright
 * inside it, and a dot, stem and chevron where each car was. The eye hides a
 * lap, the star makes it the reference for the delta.
 *
 * Two things only the page does. The wheel zooms once the bench has been
 * clicked, so scrolling past it still scrolls the page. And while nobody
 * holds the cursor and the bench is on screen, the cursor drives the lap at
 * the reference lap's own pace, sped up.
 *
 * Every word on the bench is in the markup, so the page translations reach
 * it; this file writes numbers and units only.
 */

import session from '../data/analysis-laps.json';

(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* A plot's own coordinate box, stretched to the plot by the SVG; strokes
     keep their width through non-scaling-stroke. */
  const PLOT_WIDTH = 1000;
  const PLOT_HEIGHT = 100;
  const PLOT_PAD = 6;

  const Y_TICK_TARGET = 4;
  const X_TICK_TARGET = 8;
  const NICE_STEPS = [1, 2, 2.5, 5, 10];

  const MIN_SPAN_POINTS = 30;
  const WHEEL_ZOOM_STEP = 1.25;
  const MAP_ZOOM_STEP = 1.6;
  const MAP_MAX_ZOOM = 8;

  /* The map's marks, metres, as the app draws them (AnalysisMap.tsx). */
  const TRACK_WIDTH_M = 14;
  const TICK_REACH_M = 16;
  const LABEL_OFFSET_M = 38;
  /* The cursor marker, screen pixels, pointing along +x (map-gestures.ts). */
  const MARKER_DOT_RADIUS_PX = 4.5;
  const MARKER_STEM_PATH = 'M 0 0 L 26 0';
  const MARKER_CHEVRON_PATH = 'M 19 -5 L 26 0 L 19 5';
  const MAP_LABEL_SCALE = 0.048;
  const MAP_PAD_M = 50;

  const PLAYBACK_SPEED = 3;
  const RESUME_DELAY_MS = 3500;
  const PLAQUE_GAP_PX = 10;
  const METRES_PER_KM = 1000;
  const SECTOR_PREFIX = 'S';

  const laps = session.laps;
  const lastPoint = laps[0].elapsed.length - 1;
  const stepM = session.stepM;

  const pointToMetres = (pointIndex) => pointIndex * stepM;

  const sectorStarts = session.sectors.map((share) =>
    Math.round(share * lastPoint)
  );
  const sectorEdges = [...sectorStarts, lastPoint];

  /* ---- Channels ------------------------------------------------------------

     Each chart's values per lap, its unit and digits as the app formats them
     (features/lap-analysis/channel-looks.ts), and its y range: fixed, or
     fitted to the stretch in view as uPlot fits it. */

  const lapState = {
    referenceIndex: laps.findIndex((lap) => lap.reference),
    visible: laps.map(() => true),
  };

  const deltaSeries = () =>
    laps.map((lap) =>
      lap.elapsed.map(
        (elapsedS, pointIndex) =>
          elapsedS - laps[lapState.referenceIndex].elapsed[pointIndex]
      )
    );

  const CHANNELS = {
    delta: { values: deltaSeries(), unit: 's', digits: 3, signed: true },
    speed: { values: laps.map((lap) => lap.speed), unit: 'km/h', digits: 0 },
    throttle: {
      values: laps.map((lap) => lap.throttle),
      unit: '%',
      digits: 0,
      range: [0, 100],
    },
    brake: {
      values: laps.map((lap) => lap.brake),
      unit: '%',
      digits: 0,
      range: [0, 100],
    },
    gear: {
      values: laps.map((lap) => lap.gear),
      unit: '',
      digits: 0,
      stepped: true,
    },
  };

  const formatValue = (channel, value) => {
    const sign = channel.signed && value > 0 ? '+' : '';
    const unit = channel.unit === '' ? '' : ` ${channel.unit}`;

    return `${sign}${value.toFixed(channel.digits)}${unit}`;
  };

  /* ---- Helpers ------------------------------------------------------------- */

  const makeSvg = (tag, attributes = {}) => {
    const element = document.createElementNS(SVG_NS, tag);

    Object.entries(attributes).forEach(([name, value]) =>
      element.setAttribute(name, String(value))
    );

    return element;
  };

  const makeElement = (tag, className) => {
    const element = document.createElement(tag);

    element.className = className;

    return element;
  };

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  const niceStep = (span, target) => {
    const rough = span / target;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const scaled = rough / magnitude;
    const nice = NICE_STEPS.find((candidate) => candidate >= scaled) ?? 10;

    return nice * magnitude;
  };

  const ticksBetween = (low, high, target) => {
    const step = niceStep(high - low, target);
    const ticks = [];

    for (
      let tick = Math.ceil(low / step) * step;
      tick <= high + step * 1e-6;
      tick += step
    ) {
      ticks.push(Math.abs(tick) < step * 1e-6 ? 0 : tick);
    }

    return { ticks, step };
  };

  const decimalsOf = (step) => Math.max(0, Math.ceil(-Math.log10(step) + 1e-9));

  /* ---- The view ------------------------------------------------------------

     The stretch of the lap the charts show, in grid points. */

  const view = { from: 0, to: lastPoint };

  const firstShown = () => Math.max(0, Math.floor(view.from));
  const lastShown = () => Math.min(lastPoint, Math.ceil(view.to));

  const setView = (from, to) => {
    const span = clamp(to - from, MIN_SPAN_POINTS, lastPoint);
    const start = clamp(from, 0, lastPoint - span);

    view.from = start;
    view.to = start + span;
  };

  const plotX = (pointIndex) =>
    ((pointIndex - view.from) / (view.to - view.from)) * PLOT_WIDTH;

  const plotY = (value, [low, high]) =>
    PLOT_PAD +
    (1 - (value - low) / (high - low)) * (PLOT_HEIGHT - PLOT_PAD * 2);

  const fittedRange = (channel) => {
    if (channel.range) {
      return channel.range;
    }

    let low = Infinity;
    let high = -Infinity;

    channel.values.forEach((series, lapIndex) => {
      if (!lapState.visible[lapIndex]) {
        return;
      }

      for (
        let pointIndex = firstShown();
        pointIndex <= lastShown();
        pointIndex += 1
      ) {
        low = Math.min(low, series[pointIndex]);
        high = Math.max(high, series[pointIndex]);
      }
    });

    if (!Number.isFinite(low)) {
      return [0, 1];
    }

    if (channel.stepped) {
      return [low - 0.5, high + 0.5];
    }

    const margin = (high - low) * 0.06 || 0.5;

    return [low - margin, high + margin];
  };

  const linePoints = (series, range, stepped) => {
    const points = [];
    let previousY = null;

    for (
      let pointIndex = firstShown();
      pointIndex <= lastShown();
      pointIndex += 1
    ) {
      const x = plotX(pointIndex).toFixed(1);
      const y = plotY(series[pointIndex], range).toFixed(1);

      if (stepped && previousY !== null) {
        points.push(`${x},${previousY}`);
      }

      points.push(`${x},${y}`);
      previousY = y;
    }

    return points.join(' ');
  };

  /* ---- Charts ---------------------------------------------------------------- */

  const buildChart = (figure, isLast) => {
    const channel = CHANNELS[figure.dataset.lapChart];
    const row = makeElement('div', 'bench-chart-row');
    const yAxis = makeElement('div', 'bench-y-axis');
    const plot = makeElement('div', 'bench-plot');
    const svg = makeSvg('svg', {
      class: 'bench-plot-svg',
      viewBox: `0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    });
    const backGroup = makeSvg('g');
    const lines = laps.map((lap) =>
      makeSvg('polyline', {
        class: 'bench-line',
        stroke: lap.color,
        'vector-effect': 'non-scaling-stroke',
      })
    );
    const cursor = makeElement('div', 'bench-cursor');
    const frame = makeElement('div', 'bench-frame');
    const plaque = makeElement('div', 'bench-plaque');
    const plaqueDistance = makeElement('div', 'bench-plaque-distance');
    const plaqueValues = laps.map((lap) => {
      const value = makeElement('div', 'bench-plaque-value');

      value.style.color = lap.color;

      return value;
    });

    svg.append(backGroup, ...lines);
    plaque.append(plaqueDistance, ...plaqueValues);
    plot.append(svg, cursor, frame, plaque);
    row.append(yAxis, plot);
    figure.append(row);

    let xAxis = null;

    if (isLast) {
      xAxis = makeElement('div', 'bench-x-axis');
      figure.append(xAxis);
    }

    frame.hidden = true;
    plaque.hidden = true;
    cursor.hidden = true;

    return {
      channel,
      yAxis,
      plot,
      backGroup,
      lines,
      cursor,
      frame,
      plaque,
      plaqueDistance,
      plaqueValues,
      xAxis,
    };
  };

  const drawSectorsBehind = (backGroup) => {
    sectorStarts.forEach((startIndex, sectorIndex) => {
      const from = Math.max(plotX(startIndex), 0);
      const to = Math.min(plotX(sectorEdges[sectorIndex + 1]), PLOT_WIDTH);

      if (to <= from) {
        return;
      }

      if (sectorIndex % 2 === 1) {
        backGroup.append(
          makeSvg('rect', {
            class: 'bench-sector-shade',
            x: from,
            y: 0,
            width: to - from,
            height: PLOT_HEIGHT,
          })
        );
      }

      const boundaryX = plotX(startIndex);

      if (sectorIndex > 0 && boundaryX >= 0 && boundaryX <= PLOT_WIDTH) {
        backGroup.append(
          makeSvg('line', {
            class: 'bench-sector-line',
            x1: boundaryX,
            x2: boundaryX,
            y1: 0,
            y2: PLOT_HEIGHT,
            'vector-effect': 'non-scaling-stroke',
          })
        );
      }
    });
  };

  const drawChart = (chart) => {
    const { channel, backGroup, lines, yAxis, xAxis } = chart;
    const range = fittedRange(channel);
    const { ticks, step } = ticksBetween(range[0], range[1], Y_TICK_TARGET);
    const decimals = channel.stepped ? 0 : decimalsOf(step);

    backGroup.replaceChildren();
    drawSectorsBehind(backGroup);
    yAxis.replaceChildren();

    ticks.forEach((tick) => {
      if (channel.stepped && !Number.isInteger(tick)) {
        return;
      }

      const y = plotY(tick, range);

      backGroup.append(
        makeSvg('line', {
          class: 'bench-grid-line',
          x1: 0,
          x2: PLOT_WIDTH,
          y1: y,
          y2: y,
          'vector-effect': 'non-scaling-stroke',
        })
      );

      const label = makeElement('span', 'bench-y-label');

      label.style.top = `${(y / PLOT_HEIGHT) * 100}%`;
      label.textContent = tick.toFixed(decimals);
      yAxis.append(label);
    });

    lines.forEach((line, lapIndex) => {
      line.setAttribute(
        'points',
        linePoints(channel.values[lapIndex], range, channel.stepped)
      );
      line.style.display = lapState.visible[lapIndex] ? '' : 'none';
    });

    if (xAxis) {
      drawDistanceAxis(xAxis);
    }
  };

  const drawDistanceAxis = (xAxis) => {
    const fromKm = pointToMetres(view.from) / METRES_PER_KM;
    const toKm = pointToMetres(view.to) / METRES_PER_KM;
    const { ticks, step } = ticksBetween(fromKm, toKm, X_TICK_TARGET);
    const decimals = Math.max(1, decimalsOf(step));
    const spanKm = toKm - fromKm;

    xAxis.replaceChildren();

    ticks.forEach((tickKm) => {
      const label = makeElement('span', 'bench-x-label');

      label.style.left = `${((tickKm - fromKm) / spanKm) * 100}%`;
      label.textContent = tickKm.toFixed(decimals);
      xAxis.append(label);
    });

    sectorStarts.forEach((startIndex, sectorIndex) => {
      const from = Math.max(startIndex, view.from);
      const to = Math.min(sectorEdges[sectorIndex + 1], view.to);

      if (to <= from) {
        return;
      }

      const label = makeElement('span', 'bench-sector-label');

      label.style.left = `${(((from + to) / 2 - view.from) / (view.to - view.from)) * 100}%`;
      label.textContent = `${SECTOR_PREFIX}${sectorIndex + 1}`;
      xAxis.append(label);
    });
  };

  /* ---- Map ------------------------------------------------------------------- */

  const mapXs = laps.map((lap) =>
    lap.map.filter((_, coord) => coord % 2 === 0)
  );
  const mapYs = laps.map((lap) =>
    lap.map.filter((_, coord) => coord % 2 === 1)
  );

  const pathBetween = (lapIndex, from, to) => {
    const points = [];

    for (let pointIndex = from; pointIndex <= to; pointIndex += 1) {
      points.push(
        `${mapXs[lapIndex][pointIndex]},${mapYs[lapIndex][pointIndex]}`
      );
    }

    return points.join(' ');
  };

  /* The unit vector a lap runs along at a point. */
  const headingAt = (lapIndex, pointIndex) => {
    const before = Math.max(0, pointIndex - 2);
    const after = Math.min(lastPoint, pointIndex + 2);
    const dx = mapXs[lapIndex][after] - mapXs[lapIndex][before];
    const dy = mapYs[lapIndex][after] - mapYs[lapIndex][before];
    const length = Math.hypot(dx, dy) || 1;

    return [dx / length, dy / length];
  };

  const buildMap = (mapSvg) => {
    const reference = 0;
    const allX = mapXs[reference];
    const allY = mapYs[reference];
    const left = Math.min(...allX) - MAP_PAD_M;
    const top = Math.min(...allY) - MAP_PAD_M;
    const whole = {
      x: left,
      y: top,
      width: Math.max(...allX) + MAP_PAD_M - left,
      height: Math.max(...allY) + MAP_PAD_M - top,
    };

    const band = makeSvg('polyline', {
      class: 'bench-map-band',
      points: pathBetween(reference, 0, lastPoint),
      'stroke-width': TRACK_WIDTH_M,
    });

    const marks = sectorStarts.flatMap((startIndex, sectorIndex) => {
      const [headX, headY] = headingAt(reference, startIndex);
      const normalX = -headY;
      const normalY = headX;
      const centerX = allX[startIndex];
      const centerY = allY[startIndex];
      const tick = makeSvg('line', {
        class: 'bench-map-tick',
        x1: centerX - normalX * TICK_REACH_M,
        y1: centerY - normalY * TICK_REACH_M,
        x2: centerX + normalX * TICK_REACH_M,
        y2: centerY + normalY * TICK_REACH_M,
      });
      const label = makeSvg('text', {
        class: 'bench-map-label',
        x: centerX + normalX * LABEL_OFFSET_M,
        y: centerY + normalY * LABEL_OFFSET_M,
      });

      label.textContent = `${SECTOR_PREFIX}${sectorIndex + 1}`;

      return [tick, label];
    });

    const faint = laps.map((lap, lapIndex) =>
      makeSvg('polyline', {
        class: 'bench-map-faint',
        stroke: lap.color,
        points: pathBetween(lapIndex, 0, lastPoint),
      })
    );
    const bright = laps.map((lap) =>
      makeSvg('polyline', { class: 'bench-map-bright', stroke: lap.color })
    );
    const cars = laps.map((lap) => {
      const group = makeSvg('g');

      group.append(
        makeSvg('path', {
          class: 'bench-map-stem',
          stroke: lap.color,
          d: MARKER_STEM_PATH,
        }),
        makeSvg('path', {
          class: 'bench-map-chevron',
          stroke: lap.color,
          d: MARKER_CHEVRON_PATH,
        }),
        makeSvg('circle', {
          class: 'bench-map-dot',
          fill: lap.color,
          r: MARKER_DOT_RADIUS_PX,
        })
      );

      return { group };
    });

    mapSvg.append(
      band,
      ...marks,
      ...faint,
      ...bright,
      ...cars.map((car) => car.group)
    );

    const labels = marks.filter((mark) => mark.tagName === 'text');

    return { whole, faint, bright, cars, labels, zoom: 1, center: null };
  };

  /* ---- The bench ------------------------------------------------------------- */

  const initLapAnalysis = () => {
    const bench = document.querySelector('[data-lap-bench]');

    if (!bench) {
      return;
    }

    const stack = bench.querySelector('[data-lap-charts]');
    const mapSvg = bench.querySelector('[data-lap-map]');
    const gestureHints = Array.from(bench.querySelectorAll('[data-gesture]'));
    const rows = Array.from(bench.querySelectorAll('[data-lap-row]'));
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    rows.forEach((row) => {
      const lapIndex = Number(row.dataset.lapRow);

      row.style.setProperty('--lap', laps[lapIndex].color);
    });

    const figures = Array.from(stack.querySelectorAll('[data-lap-chart]'));
    const charts = figures.map((figure, index) =>
      buildChart(figure, index === figures.length - 1)
    );
    const map = buildMap(mapSvg);

    let cursorPoint = null;

    /* ---- Drawing ------------------------------------------------------------ */

    const applyMapView = () => {
      const { whole } = map;

      if (map.zoom === 1 || !map.center) {
        mapSvg.setAttribute(
          'viewBox',
          `${whole.x} ${whole.y} ${whole.width} ${whole.height}`
        );
      } else {
        const width = whole.width / map.zoom;
        const height = whole.height / map.zoom;

        mapSvg.setAttribute(
          'viewBox',
          `${map.center[0] - width / 2} ${map.center[1] - height / 2} ${width} ${height}`
        );
      }

      sizeMapLabels();
    };

    const drawMap = () => {
      laps.forEach((_, lapIndex) => {
        const shown = lapState.visible[lapIndex];

        map.faint[lapIndex].style.display = shown ? '' : 'none';
        map.bright[lapIndex].style.display = shown ? '' : 'none';
        map.bright[lapIndex].setAttribute(
          'points',
          pathBetween(lapIndex, firstShown(), lastShown())
        );
      });
    };

    const drawAll = () => {
      charts.forEach(drawChart);
      drawMap();
      drawCursor();
    };

    /* Map units per screen pixel: the markers keep their pixel size and the
       labels their share of the view, at any zoom, as in the app. */
    const mapUnitsPerPx = () => {
      const viewWidth = mapSvg.viewBox.baseVal.width;
      const widthPx = mapSvg.clientWidth;

      return widthPx > 0 ? viewWidth / widthPx : 1;
    };

    const sizeMapLabels = () => {
      const fontSize = mapSvg.viewBox.baseVal.width * MAP_LABEL_SCALE;

      map.labels.forEach((label) => label.setAttribute('font-size', fontSize));
    };

    const drawCarOnMap = (car, lapIndex, pointIndex) => {
      const x = mapXs[lapIndex][pointIndex];
      const y = mapYs[lapIndex][pointIndex];
      const [headX, headY] = headingAt(lapIndex, pointIndex);
      const noseDegrees = (Math.atan2(headY, headX) * 180) / Math.PI;

      car.group.style.display = lapState.visible[lapIndex] ? '' : 'none';
      car.group.setAttribute(
        'transform',
        `translate(${x} ${y}) rotate(${noseDegrees}) scale(${mapUnitsPerPx()})`
      );
    };

    function drawCursor() {
      const shown = cursorPoint !== null;

      charts.forEach((chart) => {
        chart.cursor.hidden = !shown;
        chart.plaque.hidden = !shown;
      });
      map.cars.forEach((car) => {
        car.group.style.visibility = shown ? 'visible' : 'hidden';
      });

      if (!shown) {
        return;
      }

      const pointIndex = clamp(Math.round(cursorPoint), 0, lastPoint);
      const share = (cursorPoint - view.from) / (view.to - view.from);
      const kmText = `${(pointToMetres(pointIndex) / METRES_PER_KM).toFixed(3)} km`;

      charts.forEach((chart) => {
        const plotWidth = chart.plot.clientWidth;
        const cursorPx = share * plotWidth;

        chart.cursor.style.left = `${cursorPx}px`;
        chart.plaqueDistance.textContent = kmText;
        chart.plaqueValues.forEach((value, lapIndex) => {
          value.hidden = !lapState.visible[lapIndex];
          value.textContent = formatValue(
            chart.channel,
            chart.channel.values[lapIndex][pointIndex]
          );
        });

        const plaqueWidth = chart.plaque.offsetWidth;
        const flips = cursorPx + PLAQUE_GAP_PX + plaqueWidth > plotWidth;

        chart.plaque.style.left = `${flips ? cursorPx - PLAQUE_GAP_PX - plaqueWidth : cursorPx + PLAQUE_GAP_PX}px`;
      });

      map.cars.forEach((car, lapIndex) =>
        drawCarOnMap(car, lapIndex, pointIndex)
      );

      if (map.zoom > 1) {
        map.center = [mapXs[0][pointIndex], mapYs[0][pointIndex]];
        applyMapView();
      }
    }

    /* ---- Laps: the eye and the star ----------------------------------------- */

    const writeRows = () => {
      rows.forEach((row) => {
        const lapIndex = Number(row.dataset.lapRow);
        const eye = row.querySelector('[data-lap-eye]');
        const star = row.querySelector('[data-lap-star]');
        const isReference = lapIndex === lapState.referenceIndex;

        row.classList.toggle('is-hidden', !lapState.visible[lapIndex]);
        eye.classList.toggle('is-on', lapState.visible[lapIndex]);
        eye.setAttribute('aria-pressed', String(lapState.visible[lapIndex]));
        star.classList.toggle('is-reference', isReference);
        star.setAttribute('aria-pressed', String(isReference));
      });
    };

    rows.forEach((row) => {
      const lapIndex = Number(row.dataset.lapRow);

      row.querySelector('[data-lap-eye]').addEventListener('click', () => {
        lapState.visible[lapIndex] = !lapState.visible[lapIndex];
        writeRows();
        drawAll();
      });

      row.querySelector('[data-lap-star]').addEventListener('click', () => {
        lapState.referenceIndex = lapIndex;
        CHANNELS.delta.values = deltaSeries();
        writeRows();
        drawAll();
      });
    });

    /* ---- Playback ----------------------------------------------------------- */

    let playFrame = 0;
    let playClockS = 0;
    let lastFrameAt = 0;
    let resumeTimer = 0;
    let onScreen = false;
    let held = false;

    const referenceElapsed = () => laps[lapState.referenceIndex].elapsed;

    const pointAtTime = (elapsedS) => {
      const elapsed = referenceElapsed();
      let low = 0;
      let high = lastPoint;

      while (low < high) {
        const middle = (low + high) >> 1;

        if (elapsed[middle] < elapsedS) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }

      return low;
    };

    const playStep = (now) => {
      const frameS = lastFrameAt ? (now - lastFrameAt) / 1000 : 0;
      const elapsed = referenceElapsed();
      const startS = elapsed[firstShown()];
      const endS = elapsed[lastShown()];

      lastFrameAt = now;
      playClockS += frameS * PLAYBACK_SPEED;

      if (playClockS < startS || playClockS > endS) {
        playClockS = startS;
      }

      cursorPoint = clamp(pointAtTime(playClockS), view.from, view.to);
      drawCursor();
      playFrame = requestAnimationFrame(playStep);
    };

    const stopPlayback = () => {
      cancelAnimationFrame(playFrame);
      playFrame = 0;
      lastFrameAt = 0;
    };

    const startPlayback = () => {
      if (reduceMotion || held || !onScreen || playFrame) {
        return;
      }

      const elapsed = referenceElapsed();
      const startPoint =
        cursorPoint === null ? firstShown() : Math.round(cursorPoint);

      playClockS = elapsed[clamp(startPoint, 0, lastPoint)];
      playFrame = requestAnimationFrame(playStep);
    };

    const hold = () => {
      held = true;
      clearTimeout(resumeTimer);
      stopPlayback();
    };

    const release = () => {
      held = false;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startPlayback, RESUME_DELAY_MS);
    };

    /* ---- Gestures on the charts ---------------------------------------------- */

    let engaged = false;
    let drag = null;

    const lightGesture = (gesture) => {
      gestureHints.forEach((hint) =>
        hint.classList.toggle('is-lit', hint.dataset.gesture === gesture)
      );
    };

    const plotOf = (event) => {
      const plot = event.target.closest('.bench-plot');

      return plot && stack.contains(plot) ? plot : null;
    };

    const shareOnPlot = (event, plot) => {
      const box = plot.getBoundingClientRect();

      return clamp((event.clientX - box.left) / box.width, 0, 1);
    };

    const pointOnPlot = (event, plot) =>
      view.from + shareOnPlot(event, plot) * (view.to - view.from);

    const showFrame = (fromShare, toShare) => {
      const left = Math.min(fromShare, toShare);
      const width = Math.abs(toShare - fromShare);

      charts.forEach((chart) => {
        chart.frame.hidden = false;
        chart.frame.style.left = `${left * 100}%`;
        chart.frame.style.width = `${width * 100}%`;
      });
    };

    const hideFrame = () => {
      charts.forEach((chart) => {
        chart.frame.hidden = true;
      });
    };

    stack.addEventListener('pointermove', (event) => {
      const plot = drag ? drag.plot : plotOf(event);

      if (!plot) {
        return;
      }

      hold();

      if (drag && drag.mode === 'pan') {
        const shift = shareOnPlot(event, plot) - drag.startShare;
        const span = drag.startTo - drag.startFrom;

        setView(drag.startFrom - shift * span, drag.startTo - shift * span);
        drawAll();
      }

      if (drag && drag.mode === 'frame') {
        showFrame(drag.startShare, shareOnPlot(event, plot));
      }

      if (!drag) {
        lightGesture(event.shiftKey ? 'frame' : 'zoom');
      }

      cursorPoint = pointOnPlot(event, plot);
      drawCursor();
    });

    stack.addEventListener('pointerdown', (event) => {
      const plot = plotOf(event);

      if (!plot || event.button !== 0) {
        return;
      }

      engaged = true;
      hold();
      plot.setPointerCapture(event.pointerId);
      drag = {
        plot,
        mode: event.shiftKey ? 'frame' : 'pan',
        startShare: shareOnPlot(event, plot),
        startFrom: view.from,
        startTo: view.to,
      };
      lightGesture(drag.mode);
    });

    const endDrag = (event) => {
      if (!drag) {
        return;
      }

      if (drag.mode === 'frame') {
        const endShare = shareOnPlot(event, drag.plot);
        const span = drag.startTo - drag.startFrom;
        const from =
          drag.startFrom + Math.min(drag.startShare, endShare) * span;
        const to = drag.startFrom + Math.max(drag.startShare, endShare) * span;

        hideFrame();

        if (to - from >= 2) {
          setView(from, to);
          drawAll();
        }
      }

      drag = null;
      lightGesture('zoom');
    };

    stack.addEventListener('pointerup', endDrag);
    stack.addEventListener('pointercancel', endDrag);

    stack.addEventListener('pointerleave', () => {
      if (!drag) {
        lightGesture(null);
        release();
      }
    });

    stack.addEventListener('dblclick', (event) => {
      if (!plotOf(event)) {
        return;
      }

      lightGesture('whole');
      setView(0, lastPoint);
      drawAll();
    });

    stack.addEventListener(
      'wheel',
      (event) => {
        const plot = plotOf(event);

        if (!plot || !engaged) {
          return;
        }

        event.preventDefault();

        const anchorShare = shareOnPlot(event, plot);
        const anchor = view.from + anchorShare * (view.to - view.from);
        const factor = event.deltaY < 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
        const span = (view.to - view.from) * factor;

        setView(anchor - anchorShare * span, anchor + (1 - anchorShare) * span);
        lightGesture('zoom');
        drawAll();
      },
      { passive: false }
    );

    bench.addEventListener('pointerleave', () => {
      engaged = false;
    });

    bench.querySelector('[data-lap-whole]').addEventListener('click', () => {
      setView(0, lastPoint);
      drawAll();
    });

    /* ---- The map ------------------------------------------------------------ */

    mapSvg.addEventListener('pointermove', (event) => {
      const matrix = mapSvg.getScreenCTM();

      if (!matrix) {
        return;
      }

      const pointer = new DOMPoint(
        event.clientX,
        event.clientY
      ).matrixTransform(matrix.inverse());
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (
        let pointIndex = firstShown();
        pointIndex <= lastShown();
        pointIndex += 1
      ) {
        const distance =
          (mapXs[0][pointIndex] - pointer.x) ** 2 +
          (mapYs[0][pointIndex] - pointer.y) ** 2;

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = pointIndex;
        }
      }

      hold();
      cursorPoint = nearestIndex;
      drawCursor();
    });

    mapSvg.addEventListener('pointerleave', release);

    bench.querySelectorAll('[data-map-zoom]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.mapZoom;

        if (action === 'in') {
          map.zoom = Math.min(MAP_MAX_ZOOM, map.zoom * MAP_ZOOM_STEP);
        } else if (action === 'out') {
          map.zoom = Math.max(1, map.zoom / MAP_ZOOM_STEP);
        } else {
          map.zoom = 1;
        }

        const pointIndex = clamp(Math.round(cursorPoint ?? 0), 0, lastPoint);

        map.center = [mapXs[0][pointIndex], mapYs[0][pointIndex]];
        applyMapView();
      });
    });

    /* ---- Start -------------------------------------------------------------- */

    /* Without motion the cursor waits where the compared lap loses the most
       in one place: the steepest climb of the delta. */
    const steepestLoss = () => {
      const compared = CHANNELS.delta.values.find(
        (_, lapIndex) => lapIndex !== lapState.referenceIndex
      );
      let best = { pointIndex: 0, climbS: -Infinity };

      compared.forEach((deltaS, pointIndex) => {
        const climbS = deltaS - compared[Math.max(0, pointIndex - 20)];

        if (climbS > best.climbS) {
          best = { pointIndex, climbS };
        }
      });

      return best.pointIndex;
    };

    writeRows();
    applyMapView();
    cursorPoint = reduceMotion ? steepestLoss() : null;
    drawAll();

    new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);

      if (onScreen) {
        startPlayback();
      } else {
        stopPlayback();
      }
    }).observe(bench);

    window.addEventListener('resize', drawCursor);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLapAnalysis);
  } else {
    initLapAnalysis();
  }
})();
