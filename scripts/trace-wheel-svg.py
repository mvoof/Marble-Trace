"""Turn a photograph of a steering wheel into a flat SVG silhouette.

    npm run wheel:trace -- <image> <name> [options]

Writes `src/assets/wheels/<name>.svg`: one even-odd path on a square viewBox,
filled with `currentColor`, with the gaps between the spokes left transparent.
Register the new file in `SteeringWheel/WheelArt.tsx` and add its id to
`SteeringWheel/wheel-styles.ts` and the `SteeringWheelStyle` union.

Wants a wheel shot head-on on a plain light background — a product photo. The
defaults suit that; the knobs below are for the ones that fight back.

Run it through `npm run wheel:trace`, which drives uv. The dependencies are
declared in the PEP 723 block below rather than in the app's toolchain — uv
resolves them into a cached environment on first run, so there is no install
step and nothing lands in the repo.
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "numpy>=2.0",
#     "scipy>=1.13",
#     "pillow>=10.0",
#     "scikit-image>=0.24",
# ]
# ///

import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    from skimage.measure import approximate_polygon, find_contours
except ModuleNotFoundError as missing:
    raise SystemExit(
        f"missing python package: {missing.name}\n\n"
        "Run this through uv, which reads the dependencies declared at the top "
        "of this file and fetches them itself:\n\n"
        "    npm run wheel:trace -- <image> <name>\n\n"
        "See docs/steering-wheel-assets.md."
    ) from missing

ASSET_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "wheels"

# Photos come in at every size; tracing above this only buys path points.
MAX_SIDE = 1000

# Structuring element that closes stitching lines and highlight gaps.
CLOSING_FOOTPRINT = np.ones((5, 5), bool)

# Blur applied to the mask before tracing, to take the staircase off the edge.
EDGE_SOFTENING_SIGMA = 1.6


def load_luminance(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")

    if max(image.size) > MAX_SIDE:
        scale = MAX_SIDE / max(image.size)
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.LANCZOS,
        )

    pixels = np.asarray(image).astype(np.float32)

    return 0.299 * pixels[:, :, 0] + 0.587 * pixels[:, :, 1] + 0.114 * pixels[:, :, 2]


def build_mask(
    luminance: np.ndarray, threshold: float, min_hole_fraction: float
) -> np.ndarray:
    solid = ndimage.binary_closing(luminance <= threshold, CLOSING_FOOTPRINT)

    # The wheel is the largest object in the frame; watermarks, captions and
    # shadow blobs are separate components and fall away with the rest.
    labels, count = ndimage.label(solid)

    if count == 0:
        raise SystemExit("no shape found — try raising --threshold")

    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    solid = labels == (int(np.argmax(sizes)) + 1)

    # Keep the gaps between the spokes; fill screens, buttons and reflections,
    # which are holes of the same kind but far smaller.
    holes = ndimage.binary_fill_holes(solid) & ~solid
    hole_labels, hole_count = ndimage.label(holes)
    min_hole_area = min_hole_fraction * solid.sum()
    filled = solid.copy()

    for index in range(1, hole_count + 1):
        hole = hole_labels == index

        if hole.sum() < min_hole_area:
            filled |= hole

    return ndimage.gaussian_filter(filled.astype(np.float32), EDGE_SOFTENING_SIGMA) > 0.5


def mask_to_subpaths(mask: np.ndarray, tolerance: float) -> tuple[list[str], int]:
    rows, cols = np.nonzero(mask)
    top, bottom = rows.min(), rows.max() + 1
    left, right = cols.min(), cols.max() + 1

    # The pad gives find_contours a border to close shapes against; the offsets
    # take it back off and centre the wheel in a square box, so that one square
    # slot holds every wheel at the same scale however wide it was shot.
    #
    # The 0.5 is the level find_contours traced at: in the padded array the
    # shape's edges lie half a pixel outside it, so shifting by the pad's full
    # pixel would push the far side out of the viewBox.
    cropped = np.pad(mask[top:bottom, left:right], 1)
    width = right - left
    height = bottom - top
    side = int(max(width, height))
    offset_x = (side - width) / 2 - 0.5
    offset_y = (side - height) / 2 - 0.5

    subpaths = []

    for contour in find_contours(cropped.astype(np.float32), 0.5):
        simplified = approximate_polygon(contour, tolerance=tolerance)

        if len(simplified) < 4:
            continue

        points = "L".join(
            f"{point[1] + offset_x:.1f} {point[0] + offset_y:.1f}"
            for point in simplified
        )
        subpaths.append(f"M{points}Z")

    return subpaths, side


def write_svg(target: Path, subpaths: list[str], side: int) -> None:
    # One path, not one per contour: even-odd only cuts a hole out of subpaths
    # that share a <path>, so separate elements would each fill solid and the
    # gaps between the spokes would disappear.
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {side} {side}" fill="currentColor" '
        'fill-rule="evenodd" clip-rule="evenodd">\n'
        f'    <path d="{"".join(subpaths)}" />\n'
        "</svg>\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Trace a steering wheel photo into an SVG silhouette."
    )
    parser.add_argument("image", type=Path, help="source photo (jpg or png)")
    parser.add_argument("name", help="asset name, e.g. gt-round")
    parser.add_argument(
        "--threshold",
        type=float,
        default=215,
        help="luminance at or below which a pixel is wheel (0-255). Lower it "
        "when a grey background bleeds into the shape, raise it when a dark "
        "wheel comes out eaten away. Default 215.",
    )
    parser.add_argument(
        "--min-hole",
        type=float,
        default=0.002,
        help="smallest hole kept, as a fraction of the wheel's area. Raise it "
        "when buttons and screens punch specks through the shape, lower it "
        "when a real gap between the spokes gets filled in. Default 0.002.",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=1.2,
        help="outline simplification in pixels — higher is smoother and "
        "smaller, lower keeps detail. Default 1.2.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=ASSET_DIR,
        help="where to write the SVG. Defaults to src/assets/wheels.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.image.exists():
        raise SystemExit(f"no such image: {args.image}")

    luminance = load_luminance(args.image)
    mask = build_mask(luminance, args.threshold, args.min_hole)
    subpaths, side = mask_to_subpaths(mask, args.tolerance)
    target = args.out_dir / f"{args.name}.svg"
    write_svg(target, subpaths, side)

    print(f"{target} — {len(subpaths)} contours, viewBox {side}, {target.stat().st_size} bytes")


if __name__ == "__main__":
    sys.exit(main())
