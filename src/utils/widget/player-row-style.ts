import type { CSSProperties } from 'react';

/**
 * Fill for the player's own row in a driver table.
 *
 * Fills with the user-chosen colour and stacks the same colour in a thin band
 * at the top and bottom edges. Layering the colour over the fill makes those
 * edges brighter in the same hue — a glow that reads like a border.
 *
 * Returns undefined for every other driver so the caller can spread it
 * unconditionally.
 */
export const playerRowStyle = (
  isPlayer: boolean,
  playerRowColor: string
): CSSProperties | undefined =>
  isPlayer
    ? {
        background: `linear-gradient(to bottom, ${playerRowColor}, transparent 2px), linear-gradient(to top, ${playerRowColor}, transparent 2px), ${playerRowColor}`,
      }
    : undefined;
