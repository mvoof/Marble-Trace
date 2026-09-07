import { observer } from 'mobx-react-lite';

import type { ChatPlatform } from '@/types/bindings';

import styles from './PlatformGlyph.module.scss';

interface PlatformGlyphProps {
  platform: ChatPlatform;
  className?: string;
}

// lucide-react carries no brand marks, so the two glyphs are drawn here.
const PATHS: Record<ChatPlatform, string> = {
  twitch:
    'M4 2 2 6.5V21h5v3h3l3-3h4l6-6V2H4Zm16 12-3 3h-5l-3 3v-3H5V4h15v10ZM11 8h2v6h-2V8Zm6 0h2v6h-2V8Z',
  youtube:
    'M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.4a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12ZM9.8 15.5v-7l6 3.5-6 3.5Z',
};

export const PlatformGlyph = observer(
  ({ platform, className }: PlatformGlyphProps) => {
    const platformClass =
      platform === 'twitch' ? styles.glyphTwitch : styles.glyphYoutube;

    return (
      <svg
        className={[styles.glyph, platformClass, className]
          .filter(Boolean)
          .join(' ')}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d={PATHS[platform]} />
      </svg>
    );
  }
);
