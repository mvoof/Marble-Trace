import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { usePlayerStore } from '@entities/player/player-context';

const SECONDS_PER_MINUTE = 60;

/** "23s" under a minute, "1:32" from there. */
const formatTowTime = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));

  if (whole < SECONDS_PER_MINUTE) {
    return `${whole}s`;
  }

  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = String(whole % SECONDS_PER_MINUTE).padStart(2, '0');

  return `${minutes}:${rest}`;
};

/**
 * The player's tow, counting down. Only the player's own tow has a time — the
 * sim gives none for anyone else's. Written straight to its span, since it
 * ticks every bundle. See `docs/rendering.md`.
 */
export const TowTime = observer(() => {
  const player = usePlayerStore();

  const timeRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const seconds = player.pitService?.towTimeS ?? 0;

      scheduleWrite(() => {
        element.textContent = formatTowTime(seconds);
      });
    },
    [player]
  );

  return <span ref={timeRef} />;
});
