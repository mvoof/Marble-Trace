import { observer } from 'mobx-react-lite';
import { Mic } from 'lucide-react';
import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useCarsStore } from '@entities/cars/cars-context';
import { useSessionStore } from '@entities/session/session-context';
import { getContrastTextColor } from '@shared/lib/colors';
import type { RadioChannel } from '@shared/contracts/generated/bindings';
import { RadioWave } from './RadioWave';
import { CHANNEL_LABEL, resolveSpeaker } from './radio-utils';
import type { RadioWidgetSettings } from './settings-schema';
import styles from './RadioWidget.module.scss';

const CHANNEL_CLASS: Record<RadioChannel, string> = {
  all: styles.channelAll,
  team: styles.channelTeam,
  raceControl: styles.channelRaceControl,
  club: styles.channelClub,
  other: styles.channelOther,
};

/** What the plate says with nobody on the air — seen only while placing it. */
const IDLE_LABEL = 'RADIO';

/**
 * Who is talking on the radio. The sim reports one transmission at a time and
 * no level, so the wave is a loop that runs while somebody talks, not a meter.
 *
 * Off the air the widget is taken off screen by WidgetAutoHideStore; what is
 * drawn here then is the quiet plate the layout editor shows.
 */
export const RadioWidget = observer(() => {
  const { radioTransmission } = useCarsStore();
  const { sessionInfo } = useSessionStore();
  const settings = useWidgetSettings<RadioWidgetSettings>('radio');

  const speaker = resolveSpeaker(
    radioTransmission,
    sessionInfo,
    settings.nameFormat
  );

  if (!speaker) {
    return (
      <WidgetPanel minWidth={0} gap={0} className={styles.root}>
        <div className={styles.wave}>
          <RadioWave isTalking={false} />
        </div>

        <div className={styles.footer}>
          <Mic className={styles.mic} aria-hidden="true" />
          <div className={styles.name}>{IDLE_LABEL}</div>
        </div>
      </WidgetPanel>
    );
  }

  return (
    <WidgetPanel
      minWidth={0}
      gap={0}
      className={`${styles.root} ${CHANNEL_CLASS[speaker.channel]}`}
    >
      <div
        className={styles.number}
        style={{
          backgroundColor: speaker.classColor,
          color: getContrastTextColor(speaker.classColor),
        }}
      >
        {speaker.carNumber}
      </div>

      {settings.showChannel && (
        <div className={styles.channel}>{CHANNEL_LABEL[speaker.channel]}</div>
      )}

      <div className={styles.wave}>
        <RadioWave isTalking />
      </div>

      <div className={styles.footer}>
        <Mic className={styles.mic} aria-hidden="true" />

        <div className={styles.name}>{speaker.name}</div>
      </div>
    </WidgetPanel>
  );
});
