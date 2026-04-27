import { useEffect, useRef, useState } from 'react';

export const useFlagBlink = (): boolean => {
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);

  return blinkOn;
};

export const useFlagHold = <T>(
  liveValue: T,
  isEmpty: (v: T) => boolean,
  emptyValue: T,
  holdDuration: number
): T => {
  const [displayValue, setDisplayValue] = useState<T>(liveValue);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayValueRef = useRef(displayValue);
  displayValueRef.current = displayValue;

  useEffect(() => {
    if (!isEmpty(liveValue)) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setDisplayValue(liveValue);
    } else {
      if (holdDuration > 0 && !isEmpty(displayValueRef.current)) {
        holdTimerRef.current = setTimeout(() => {
          setDisplayValue(emptyValue);
        }, holdDuration * 1000);
      } else if (holdDuration === 0) {
        setDisplayValue(emptyValue);
      }
    }
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [liveValue, holdDuration]);

  return displayValue;
};
