import { observer } from 'mobx-react-lite';
import {
  StatChip,
  type StatChipLook,
  type StatChipTone,
} from '@shared/ui/StatChip/StatChip';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import styles from './EnginePanelWidget.module.scss';

export interface AdjustmentChipProps {
  text: string;
  tone?: StatChipTone;
  look?: StatChipLook;
}

/**
 * An adjustment's figure in a quiet chip — a deep shade of its tone, the
 * figure light on it — as the timing widgets draw their readings. The strip
 * sets the size.
 */
export const AdjustmentChip = observer(
  ({ text, tone = 'neutral', look = 'reading' }: AdjustmentChipProps) => (
    <StatChip
      tone={tone}
      look={look}
      leadKind="number"
      lead={<FixedDigits text={text} />}
      className={styles.chip}
    />
  )
);
