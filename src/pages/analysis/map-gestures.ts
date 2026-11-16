import {
  boundsOf,
  nearestPoint,
  noseDegreesAt,
  svgPathOf,
  type MapBounds,
  type ProjectedPath,
} from '@features/lap-analysis/map-projection';
import { longestRun, type ChartViewport } from '@shared/lib/chart-viewport';

/** Room around what the map fits, a share of its size. */
const FIT_PADDING = 0.08;
/** A button's zoom step. */
const BUTTON_ZOOM = 0.7;
const WHEEL_ZOOM_IN = 0.85;
const WHEEL_ZOOM_OUT = 1 / WHEEL_ZOOM_IN;
/** Label size against the view's width. */
export const LABEL_SCALE = 0.048;
/**
 * A lap's cursor marker, in screen pixels whatever the zoom: a dot where the
 * car was and, ahead of it, a chevron the way its nose pointed. Drawn facing
 * east, written rotated.
 */
export const MARKER_DOT_RADIUS_PX = 4.5;
export const MARKER_CHEVRON_PATH = 'M 19 -5 L 26 0 L 19 5';
/** A thin line from the dot to the chevron's tip. */
export const MARKER_STEM_PATH = 'M 0 0 L 26 0';
/** The hover reaches the track within this share of the view's width. */
const HOVER_REACH = 0.04;
/** A view this close to the whole box counts as the whole lap. */
const WHOLE_SHARE = 0.999;
const MAIN_BUTTON = 0;
const MIN_VIEW_M = 30;

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const paddedBox = (bounds: MapBounds): ViewBox => {
  const width = Math.max(bounds.maxX - bounds.minX, MIN_VIEW_M);
  const height = Math.max(bounds.maxY - bounds.minY, MIN_VIEW_M);
  const padding = Math.max(width, height) * FIT_PADDING;

  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
};

const scaledBox = (
  box: ViewBox,
  factor: number,
  atX: number,
  atY: number
): ViewBox => {
  const width = Math.max(box.width * factor, MIN_VIEW_M);
  const height = box.height * (width / box.width);

  return {
    x: atX - ((atX - box.x) / box.width) * width,
    y: atY - ((atY - box.y) / box.height) * height,
    width,
    height,
  };
};

/** The SVG nodes the gestures write to, filled by the map's refs. */
export interface MapElements {
  svg: SVGSVGElement;
  tools: Element | null;
  brights: (SVGPathElement | null)[];
  markers: (SVGGElement | null)[];
  labels: (SVGTextElement | null)[];
  select: SVGRectElement | null;
}

export interface MapGestureInput {
  elements: MapElements;
  paths: (ProjectedPath | null)[];
  referencePath: ProjectedPath;
  fullBounds: MapBounds;
  viewport: ChartViewport;
  /** The view box, kept by the component across rebuilds. */
  box: { current: ViewBox | null };
}

type Drag =
  | { kind: 'pan'; startX: number; startY: number; startBox: ViewBox }
  | { kind: 'frame'; startX: number; startY: number };

/**
 * The map's gestures and live writes: wheel zooms at the pointer, drag pans a
 * zoomed view, Shift + drag frames an area, double click or the fit button
 * shows the whole lap. The view publishes the stretch in it to the charts and
 * follows a stretch the charts pick. Answers a function that takes them off.
 */
export const attachMapGestures = ({
  elements,
  paths,
  referencePath,
  fullBounds,
  viewport,
  box,
}: MapGestureInput): (() => void) => {
  const { svg, tools } = elements;
  const fullBox = paddedBox(fullBounds);
  box.current = box.current ?? fullBox;
  let drag: Drag | null = null;

  const isWhole = () =>
    box.current !== null && box.current.width >= fullBox.width * WHOLE_SHARE;

  const restingCursor = () => (isWhole() ? 'zoom-in' : 'grab');

  const writeBright = () => {
    const range = viewport.range;

    paths.forEach((path, index) => {
      const bright = elements.brights[index];

      if (path === null || bright === null || bright === undefined) {
        return;
      }

      bright.setAttribute(
        'd',
        range === null
          ? svgPathOf(path)
          : svgPathOf(path, Math.floor(range[0]), Math.ceil(range[1]))
      );
    });
  };

  /** Units of the view a screen pixel spans. */
  const unitsPerPixel = () => {
    const current = box.current ?? fullBox;
    const widthPx = svg.getBoundingClientRect().width;

    return widthPx > 0 ? current.width / widthPx : current.width * LABEL_SCALE;
  };

  const writeMarkers = (metres: number | null) => {
    const pixelScale = unitsPerPixel();

    paths.forEach((path, index) => {
      const marker = elements.markers[index];

      if (marker === null || marker === undefined) {
        return;
      }

      const point = metres === null ? -1 : Math.round(metres);

      if (
        path === null ||
        point < 0 ||
        point >= path.xs.length ||
        path.fixed[point] === 0
      ) {
        marker.setAttribute('visibility', 'hidden');

        return;
      }

      marker.setAttribute(
        'transform',
        `translate(${path.xs[point]} ${path.ys[point]}) rotate(${noseDegreesAt(path, point)}) scale(${pixelScale})`
      );
      marker.setAttribute('visibility', 'visible');
    });
  };

  /** Writes the view box; the labels and the arrows keep their screen size. */
  const writeBox = () => {
    const current = box.current ?? fullBox;

    svg.setAttribute(
      'viewBox',
      `${current.x} ${current.y} ${current.width} ${current.height}`
    );
    elements.labels.forEach((label) =>
      label?.setAttribute('font-size', String(current.width * LABEL_SCALE))
    );
    svg.style.cursor = drag?.kind === 'pan' ? 'grabbing' : restingCursor();
    writeMarkers(viewport.cursorM);
  };

  /** The map's view moved: the charts take the longest stretch in it. */
  const publishRange = () => {
    const current = box.current ?? fullBox;

    if (isWhole()) {
      viewport.setRange(null, 'map');

      return;
    }

    const inside = Array.from(referencePath.xs, (x, index) => {
      const y = referencePath.ys[index];

      return (
        referencePath.fixed[index] === 1 &&
        x >= current.x &&
        x <= current.x + current.width &&
        y >= current.y &&
        y <= current.y + current.height
      );
    });
    const run = longestRun(inside);

    viewport.setRange(run === null ? null : [run[0], run[1]], 'map');
  };

  const fitTo = (range: readonly [number, number] | null) => {
    const bounds =
      range === null
        ? fullBounds
        : boundsOf(referencePath, Math.floor(range[0]), Math.ceil(range[1]));

    box.current = bounds ? paddedBox(bounds) : fullBox;
    writeBox();
  };

  const toSvg = (event: MouseEvent): [number, number] => {
    const matrix = svg.getScreenCTM();

    if (matrix === null) {
      return [0, 0];
    }

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );

    return [point.x, point.y];
  };

  const zoomAt = (factor: number, atX: number, atY: number) => {
    const next = scaledBox(box.current ?? fullBox, factor, atX, atY);

    box.current = next.width >= fullBox.width ? fullBox : next;
    writeBox();
    publishRange();
  };

  const showWhole = () => {
    box.current = fullBox;
    writeBox();
    viewport.setRange(null, 'map');
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const [x, y] = toSvg(event);

    zoomAt(event.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN, x, y);
  };

  const panTo = (event: MouseEvent, pan: Extract<Drag, { kind: 'pan' }>) => {
    const metresPerPixel =
      pan.startBox.width / svg.getBoundingClientRect().width;

    box.current = {
      ...pan.startBox,
      x: pan.startBox.x - (event.clientX - pan.startX) * metresPerPixel,
      y: pan.startBox.y - (event.clientY - pan.startY) * metresPerPixel,
    };
    writeBox();
    publishRange();
  };

  const drawFrame = (
    x: number,
    y: number,
    frame: Extract<Drag, { kind: 'frame' }>
  ) => {
    const select = elements.select;

    select?.setAttribute('x', String(Math.min(frame.startX, x)));
    select?.setAttribute('y', String(Math.min(frame.startY, y)));
    select?.setAttribute('width', String(Math.abs(x - frame.startX)));
    select?.setAttribute('height', String(Math.abs(y - frame.startY)));
    select?.setAttribute('visibility', 'visible');
  };

  const handleMove = (event: MouseEvent) => {
    if (drag?.kind === 'pan') {
      panTo(event, drag);

      return;
    }

    const [x, y] = toSvg(event);

    if (drag?.kind === 'frame') {
      drawFrame(x, y, drag);

      return;
    }

    const reach = (box.current?.width ?? fullBox.width) * HOVER_REACH;

    if (event.shiftKey) {
      viewport.setGesture('frame');
    } else {
      viewport.setGesture(isWhole() ? 'zoom' : 'pan');
    }

    const cursorM = nearestPoint(referencePath, x, y, reach);

    if (event.shiftKey) {
      svg.style.cursor = 'crosshair';
    } else if (cursorM === null) {
      svg.style.cursor = restingCursor();
    } else {
      // The arrows mark the spot; the pointer would hide them.
      svg.style.cursor = 'none';
    }

    viewport.setCursor(cursorM, 'map');
  };

  const handleUp = (event: MouseEvent) => {
    if (drag?.kind === 'frame') {
      const [x, y] = toSvg(event);

      elements.select?.setAttribute('visibility', 'hidden');

      if (x !== drag.startX && y !== drag.startY) {
        box.current = paddedBox({
          minX: Math.min(drag.startX, x),
          minY: Math.min(drag.startY, y),
          maxX: Math.max(drag.startX, x),
          maxY: Math.max(drag.startY, y),
        });
        publishRange();
      }
    }

    drag = null;
    writeBox();
    window.removeEventListener('mouseup', handleUp);
  };

  const handleDown = (event: MouseEvent) => {
    if (event.button !== MAIN_BUTTON) {
      return;
    }

    if (event.shiftKey) {
      const [x, y] = toSvg(event);

      drag = { kind: 'frame', startX: x, startY: y };
    } else if (!isWhole() && box.current !== null) {
      drag = {
        kind: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        startBox: box.current,
      };
    } else {
      return;
    }

    event.preventDefault();
    window.addEventListener('mouseup', handleUp);
    writeBox();
  };

  const handleLeave = () => {
    if (drag === null) {
      viewport.setCursor(null, 'map');
      viewport.setGesture(null);
    }
  };

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Shift' && svg.matches(':hover')) {
      svg.style.cursor =
        event.type === 'keydown' ? 'crosshair' : restingCursor();
    }
  };

  const handleButton = (event: Event) => {
    const action = (event.target as Element | null)
      ?.closest('[data-map-action]')
      ?.getAttribute('data-map-action');
    const current = box.current ?? fullBox;
    const centreX = current.x + current.width / 2;
    const centreY = current.y + current.height / 2;

    if (action === 'in') {
      zoomAt(BUTTON_ZOOM, centreX, centreY);
    } else if (action === 'out') {
      zoomAt(1 / BUTTON_ZOOM, centreX, centreY);
    } else if (action === 'fit') {
      showWhole();
    }
  };

  const stopRange = viewport.onRange((range, source) => {
    writeBright();

    if (source === 'chart') {
      fitTo(range);
    }
  });
  const stopCursor = viewport.onCursor((metres) => writeMarkers(metres));

  svg.addEventListener('wheel', handleWheel, { passive: false });
  svg.addEventListener('mousedown', handleDown);
  svg.addEventListener('mousemove', handleMove);
  svg.addEventListener('mouseleave', handleLeave);
  svg.addEventListener('dblclick', showWhole);
  window.addEventListener('keydown', handleKey);
  window.addEventListener('keyup', handleKey);
  tools?.addEventListener('click', handleButton);
  fitTo(viewport.range);
  writeBright();
  writeMarkers(viewport.cursorM);

  return () => {
    stopRange();
    stopCursor();
    svg.removeEventListener('wheel', handleWheel);
    svg.removeEventListener('mousedown', handleDown);
    svg.removeEventListener('mousemove', handleMove);
    svg.removeEventListener('mouseleave', handleLeave);
    svg.removeEventListener('dblclick', showWhole);
    window.removeEventListener('keydown', handleKey);
    window.removeEventListener('keyup', handleKey);
    window.removeEventListener('mouseup', handleUp);
    tools?.removeEventListener('click', handleButton);
  };
};
