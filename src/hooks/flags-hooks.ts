import { useEffect, useReducer, useRef, useState } from 'react';

export const useFlagBlink = (): boolean => {
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);

  return blinkOn;
};

type FlagHoldAction<T> = { type: 'SET'; value: T };

const flagHoldReducer = <T>(state: T, action: FlagHoldAction<T>): T => {
  if (action.type === 'SET') return action.value;
  return state;
};

export const useFlagHold = <T>(
  liveValue: T,
  isEmpty: (v: T) => boolean,
  emptyValue: T,
  holdDuration: number
): T => {
  const [displayValue, dispatch] = useReducer(
    flagHoldReducer as (state: T, action: FlagHoldAction<T>) => T,
    liveValue
  );
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayValueRef = useRef(displayValue);
  displayValueRef.current = displayValue;

  useEffect(() => {
    if (!isEmpty(liveValue)) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      dispatch({ type: 'SET', value: liveValue });
    } else {
      if (holdDuration > 0 && !isEmpty(displayValueRef.current)) {
        holdTimerRef.current = setTimeout(() => {
          dispatch({ type: 'SET', value: emptyValue });
        }, holdDuration * 1000);
      } else if (holdDuration === 0) {
        dispatch({ type: 'SET', value: emptyValue });
      }
    }
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [liveValue, holdDuration, isEmpty, emptyValue]);

  return displayValue;
};
