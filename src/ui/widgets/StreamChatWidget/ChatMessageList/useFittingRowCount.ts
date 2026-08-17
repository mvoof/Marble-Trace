import { useCallback, useLayoutEffect, type RefObject } from 'react';
import { runInAction } from 'mobx';

import type { StreamChatWidgetStore } from '../stream-chat.widget';

/**
 * Counts the rows the list can actually show and hands the number to the store.
 *
 * The list is bottom-anchored and clipped at the top, so a row is on screen
 * exactly when its top edge is still inside the container. Message height
 * depends on how much text wrapped, which is why this has to be measured
 * instead of derived from the widget size.
 */
export const useFittingRowCount = (
  listRef: RefObject<HTMLDivElement | null>,
  chatWidget: StreamChatWidgetStore
) => {
  const measure = useCallback(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const rows = [...list.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset.chatRow === 'true'
    );

    const fitting = rows.filter((row) => row.offsetTop >= 0).length;

    runInAction(() => chatWidget.setFittingCount(fitting));
  }, [listRef, chatWidget]);

  // Runs after every render, so a new message or a settings change re-measures
  // on its own; the observer covers resizes that do not re-render the list.
  useLayoutEffect(measure);

  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(list);

    return () => observer.disconnect();
  }, [listRef, measure]);
};
