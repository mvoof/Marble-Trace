import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Input, type InputRef } from 'antd';
import styles from './CrewPage.module.scss';

interface BlockInputProps {
  value: string;
  /** Takes the free width — the one field of an empty line. */
  wide?: boolean;
  /** Takes the focus when it appears: a block just added. */
  focusOnMount?: boolean;
  placeholder?: string;
  onCommit: (value: string) => void;
  /** The field was left, changed or not — a block being added goes away. */
  onDone?: () => void;
}

/**
 * A block's text, kept as typed until it is left or Enter is pressed: the
 * block it belongs to is rebuilt from the whole sentence on every change,
 * which would otherwise eat a space typed at its end.
 */
export const BlockInput = observer(
  ({
    value,
    wide = false,
    focusOnMount = false,
    placeholder,
    onCommit,
    onDone,
  }: BlockInputProps) => {
    const [draft, setDraft] = useState<string | null>(null);
    const inputRef = useRef<InputRef>(null);
    const shown = draft ?? value;

    useEffect(() => {
      if (focusOnMount) {
        inputRef.current?.focus();
      }
    }, [focusOnMount]);

    const commit = () => {
      if (draft !== null && draft !== value) {
        onCommit(draft);
      }

      setDraft(null);
      onDone?.();
    };

    return (
      <Input
        size="small"
        variant={wide ? 'outlined' : 'borderless'}
        ref={inputRef}
        className={
          wide
            ? `${styles.blockInput} ${styles.blockInputWide}`
            : styles.blockInput
        }
        value={shown}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onPressEnter={commit}
      />
    );
  }
);
