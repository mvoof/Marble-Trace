import {
  resolveWheelImageSrc,
  saveWheelImage,
} from '@shared/api/wheel-image.service';

/**
 * The longest side a stored wheel keeps. The wheel slot is the widget's height,
 * a few hundred pixels at the largest scale, so this stays sharp on a 2× screen
 * while the file stays a few dozen kilobytes.
 */
const MAX_SIDE_PX = 384;

/** A picture past this is refused before it is decoded at all. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const WEBP_QUALITY = 0.9;

export const ACCEPTED_WHEEL_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/bmp',
];

export type WheelImageError = 'unsupported' | 'tooLarge' | 'unreadable';

export class WheelImageImportError extends Error {
  constructor(readonly reason: WheelImageError) {
    super(reason);
  }
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new WheelImageImportError('unreadable'));
    reader.onerror = () => reject(new WheelImageImportError('unreadable'));
    reader.readAsDataURL(file);
  });

// Through a `data:` URL rather than a `blob:` one: the app's CSP lets images
// load from `data:` but not from `blob:`.
const loadImage = async (file: File): Promise<HTMLImageElement> => {
  const dataUrl = await readAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new WheelImageImportError('unreadable'));
    image.src = dataUrl;
  });
};

const encode = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new WheelImageImportError('unreadable')),
      'image/webp',
      WEBP_QUALITY
    );
  });

/**
 * Shrinks the picture to fit `MAX_SIDE_PX` (never enlarging it), keeping its
 * proportions and its transparency, and re-encodes it as WebP. Drawing through
 * a canvas also turns an SVG into plain pixels, so nothing scripted is stored.
 */
const shrink = async (file: File): Promise<Uint8Array<ArrayBuffer>> => {
  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth || MAX_SIDE_PX;
  const sourceHeight = image.naturalHeight || MAX_SIDE_PX;
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(sourceWidth, sourceHeight));

  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');

  if (!context) {
    throw new WheelImageImportError('unreadable');
  }

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await encode(canvas);

  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * Takes the file the user picked and stores a shrunk copy beside the settings.
 * Returns the stored file name — what `customWheelImage` keeps.
 */
export const importCustomWheelImage = async (file: File): Promise<string> => {
  if (!ACCEPTED_WHEEL_IMAGE_TYPES.includes(file.type)) {
    throw new WheelImageImportError('unsupported');
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new WheelImageImportError('tooLarge');
  }

  return saveWheelImage(await shrink(file), 'webp');
};

/**
 * Where a webview loads a stored wheel picture from; `null` on a remote screen,
 * which has no way to the app's files.
 */
export const resolveCustomWheelSrc = (name: string): Promise<string | null> =>
  resolveWheelImageSrc(name);
