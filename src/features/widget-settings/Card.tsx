import { createContext, use, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useSettingsPanelUiStore } from '@entities/widget/settings-panel-ui-context';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { settingsGroupOrder, type SettingsGroup } from './settings-groups';

/**
 * Which widget the surrounding panel is editing. Supplied by WidgetSettings so
 * a card can remember its folded state per widget without every panel having to
 * thread the id through forty call sites.
 */
export const PanelWidgetContext = createContext<string | null>(null);

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

type CardProps = {
  /** Starts unfolded. Most groups start folded so a long panel fits. */
  defaultOpen?: boolean;
  children: ReactNode;
} & (
  | {
      /**
       * One of the groups every widget shares: it names the card and puts it
       * in its place among the panel's cards, whatever the source order.
       */
      group: SettingsGroup;
      title?: never;
    }
  | {
      group?: never;
      /** A block of the widget's own, under a name of its own. */
      title?: string;
    }
);

export const Card = observer(
  ({ group, title: ownTitle, defaultOpen = false, children }: CardProps) => {
    const panelUi = useSettingsPanelUiStore();
    const widgetId = use(PanelWidgetContext);
    const { t } = useTranslation('main-app');

    const title =
      group === undefined ? ownTitle : t(`widgetSettings.groups.${group}`);

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

    const isOpen =
      !isCollapsible || panelUi.isExpanded(widgetId, groupId, defaultOpen);

    return (
      // The panel's cards and the common ones WidgetSettings adds share one
      // flex column; the order is how a panel's Behaviour lands after them.
      <div className={styles.card} style={{ order: settingsGroupOrder(group) }}>
        {title &&
          (isCollapsible ? (
            <button
              type="button"
              className={styles.cardHeader}
              aria-expanded={isOpen}
              onClick={() => panelUi.toggle(widgetId, groupId, defaultOpen)}
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
  }
);
