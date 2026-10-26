import { observer } from 'mobx-react-lite';
import { Mic } from 'lucide-react';
import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { getContrastTextColor } from '@shared/lib/colors';
import type { RadioChannel } from '@shared/contracts/generated/bindings';
import { RadioWave } from './RadioWave';
import { useRadioWidgetStore } from './radio.store';
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
 * Who is talking on the radio. With nobody on the air the plate can hold the
 * player's channel alone: for a moment after the player changes it, or all
 * the time (`idleShowsChannel`). The sim reports one transmission at a
 * time and no level, so the wave behind the name is a loop that runs while
 * somebody talks, not a meter.
 *
 * The plate is as big as what it holds — the tile while someone talks, the
 * channel tab alone otherwise — so the widget paints its own ground and the
 * container hugs it (`contentSized`). Off the air the widget is taken off
 * screen by WidgetAutoHideStore; the quiet tile is what the layout editor
 * shows.
 */
export const RadioWidget = observer(() => {
  const store = useRadioWidgetStore();
  const { speaker, isTalking, settings, idleChannel } = store;

  if (!speaker && idleChannel) {
    return (
      <WidgetPanel
        minWidth={0}
        gap={0}
        fitContent
        className={`${styles.root} ${CHANNEL_CLASS[idleChannel.channel]}`}
      >
        <div className={styles.idleChannel}>
          <Mic className={styles.idleMic} aria-hidden="true" />
          <span className={styles.idleLabel}>{idleChannel.channelLabel}</span>
        </div>
      </WidgetPanel>
    );
  }

  if (!speaker) {
    return (
      <WidgetPanel minWidth={0} gap={0} fitContent className={styles.root}>
        <div className={styles.tile}>
          <div className={styles.body}>
            <RadioWave isTalking={false} />

            <div className={styles.name}>
              <div className={styles.nameLine}>{IDLE_LABEL}</div>
            </div>
          </div>
        </div>
      </WidgetPanel>
    );
  }

  return (
    <WidgetPanel
      minWidth={0}
      gap={0}
      fitContent
      className={`${styles.root} ${CHANNEL_CLASS[speaker.channel]}`}
    >
      <div className={styles.tile}>
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
          <div className={styles.channel}>
            <Mic className={styles.mic} aria-hidden="true" />
            <span className={styles.channelLabel}>{speaker.channelLabel}</span>
          </div>
        )}

        <div className={styles.body}>
          <RadioWave isTalking={isTalking} />

          <div className={styles.name}>
            <div className={styles.nameLine}>{speaker.firstLine}</div>

            {speaker.secondLine && (
              <div className={styles.nameLine}>{speaker.secondLine}</div>
            )}
          </div>
        </div>
      </div>
    </WidgetPanel>
  );
});
