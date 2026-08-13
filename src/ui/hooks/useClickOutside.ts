import { useEffect, useRef } from 'react';

export const useClickOutside = <T extends HTMLElement>(onClose: () => void) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', onMouseDown);

    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  return ref;
};
