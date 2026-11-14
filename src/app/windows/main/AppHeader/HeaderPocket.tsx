import { useLayoutEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { pocketPath } from './pocket-path';
import styles from './AppHeader.module.scss';

type HeaderPocketProps = {
  header: HTMLElement | null;
  items: HTMLElement | null;
};

type PocketShape = { width: number; height: number; path: string };

/** The cut-out behind the top items, redrawn whenever they or the header resize. */
export const HeaderPocket = observer(({ header, items }: HeaderPocketProps) => {
  const [shape, setShape] = useState<PocketShape | null>(null);

  useLayoutEffect(() => {
    if (header === null || items === null) {
      return;
    }

    const measure = () => {
      const headerBox = header.getBoundingClientRect();
      const itemsBox = items.getBoundingClientRect();

      setShape({
        width: headerBox.width,
        height: headerBox.height,
        path: pocketPath({
          left: itemsBox.left - headerBox.left,
          width: itemsBox.width,
          top: itemsBox.top - headerBox.top,
          bottom: itemsBox.bottom - headerBox.top,
        }),
      });
    };

    const resizeObserver = new ResizeObserver(measure);

    resizeObserver.observe(header);
    resizeObserver.observe(items);

    return () => {
      resizeObserver.disconnect();
    };
  }, [header, items]);

  if (shape === null) {
    return null;
  }

  return (
    <svg
      className={styles.pocket}
      width={shape.width}
      height={shape.height}
      aria-hidden="true"
    >
      <path d={shape.path} />
    </svg>
  );
});
