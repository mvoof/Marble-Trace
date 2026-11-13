import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import {
  MENU_SEPARATOR,
  type MenuSection,
  type SectionMenuEntry,
} from './section-menu';
import styles from './SectionedPage.module.scss';

const MENU_ICON_SIZE = 16;

interface SectionedPageProps<SectionId extends string> {
  /** The inner menu, top to bottom. */
  menu: readonly SectionMenuEntry<MenuSection<SectionId>>[];
  active: SectionId;
  onSelect: (section: SectionId) => void;
  /** The active section's content, under its name. */
  children: ReactNode;
  /**
   * The section fills the pane and scrolls inside itself (an editor with its
   * own list); the content below the name is then a column that fills it.
   */
  fillsHeight?: boolean;
}

/**
 * The main window's template for a page with more than one section: a narrow
 * inner menu on the left (icons only in a narrow window), the active section on
 * the right under its name. Every such page draws its menu here.
 */
const SectionedPageView = <SectionId extends string>({
  menu,
  active,
  onSelect,
  children,
  fillsHeight = false,
}: SectionedPageProps<SectionId>) => {
  const activeSection = menu.find(
    (entry): entry is MenuSection<SectionId> =>
      entry !== MENU_SEPARATOR && entry.id === active
  );

  return (
    <div className={styles.page}>
      <nav className={styles.menu}>
        {menu.map((entry, index) => {
          if (entry === MENU_SEPARATOR) {
            return (
              <hr
                key={`${MENU_SEPARATOR}-${index}`}
                className={styles.separator}
              />
            );
          }

          const { id, label, icon: Icon } = entry;
          const isActive = id === active;

          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? styles.itemActive : styles.item}
              onClick={() => onSelect(id)}
            >
              <Icon size={MENU_ICON_SIZE} className={styles.itemIcon} />

              <span className={styles.itemLabel}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Keyed so another section opens at its top, not at the last one's scroll. */}
      <main
        className={fillsHeight ? styles.contentFill : styles.content}
        key={active}
      >
        <div
          className={
            fillsHeight ? styles.contentInnerFill : styles.contentInner
          }
        >
          <h1 className={styles.title}>{activeSection?.label}</h1>

          {children}
        </div>
      </main>
    </div>
  );
};

// `observer` drops the generic; the cast gives it back to callers.
export const SectionedPage = observer(
  SectionedPageView
) as typeof SectionedPageView;
