import { createContext, use, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronDown } from 'lucide-react';
import { useSettingsPanelUiStore } from '@store/root-store-context';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';

/**
 * Which widget the surrounding panel is editing. Supplied by WidgetSettings so
 * a card can remember its folded state per widget without every panel having to
 * thread the id through forty call sites.
 */
const PanelWidgetContext = createContext<string | null>(null);

export const PanelWidgetProvider = ({
  widgetId,
  children,
}: {
  widgetId: string;
  children: ReactNode;
}) => (
  <PanelWidgetContext.Provider value={widgetId}>
    {children}
  </PanelWidgetContext.Provider>
);

interface CardProps {
  title?: string;
  children: ReactNode;
}

export const Card = observer(({ title, children }: CardProps) => {
  const panelUi = useSettingsPanelUiStore();
  const widgetId = use(PanelWidgetContext);

  // The translated title doubles as the group key: the folded state is
  // session-only, so the worst a language switch can do is fold a group back.
  //
  // Two cards in one panel must therefore not share a title, or they would open
  // and close together — keep group names distinct rather than keying off the
  // render order, which shifts as panels show and hide cards conditionally.
  const groupId = title ?? '';

  // A card with no title has no header to click, and outside a panel (previews,
  // Storybook) there is nothing to key the state on — both stay always open.
  const isCollapsible = title !== undefined && widgetId !== null;

  const isOpen = !isCollapsible || panelUi.isExpanded(widgetId, groupId);

  return (
    <div className={styles.card}>
      {title &&
        (isCollapsible ? (
          <button
            type="button"
            className={styles.cardHeader}
            aria-expanded={isOpen}
            onClick={() => panelUi.toggle(widgetId, groupId)}
          >
            <ChevronDown
              size={12}
              className={isOpen ? styles.cardChevronOpen : styles.cardChevron}
            />

            <span className={styles.cardTitle}>{title}</span>
          </button>
        ) : (
          <h3 className={styles.cardTitle}>{title}</h3>
        ))}

      {isOpen && <div className={styles.cardContent}>{children}</div>}
    </div>
  );
});
