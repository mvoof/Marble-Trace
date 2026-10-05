import { createContext, use, useMemo, type ReactNode } from 'react';
import type {
  BaseUserSettings,
  WidgetDefaultConfig,
  WidgetSpecificSettings,
  WidgetUserSettings,
} from '@/types/widget-settings';
import type { LiveWidgetsStore } from '@store/settings/live-widgets.store';
import type { WidgetDefaultsStore } from '@store/settings/widget-defaults.store';
import type { SettingsMutationLog } from '@store/settings/mutation-log';
import { useWidgetDefaultsStore } from '@store/root-store-context';
import { MainRootContext } from '@store/main-root-context';

// A small editing target so the settings panels don't care WHAT they edit. The
// Widgets catalog binds this to the global defaults, the F9 overlay popup to
// the commands it sends main (`WidgetEditorProvider`); the layout editor falls
// back to the live active-layout store.
export interface WidgetEditor {
  getWidget(id: string): WidgetDefaultConfig | undefined;
  getSettings<SpecificSettings extends WidgetSpecificSettings>(
    id: string
  ): BaseUserSettings & SpecificSettings;
  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>): void;
  // Reactive change counter the preview reads to know when to re-mirror.
  getChangeToken(): number;
  pushUndo?(): void;
}

const liveEditor = (
  store: LiveWidgetsStore,
  mutations: SettingsMutationLog
): WidgetEditor => ({
  getWidget: (id) => store.getWidget(id),
  getSettings: <S extends WidgetSpecificSettings>(id: string) =>
    store.getSettings<S>(id),
  updateUserSettings: (id, partial) => store.updateUserSettings(id, partial),
  getChangeToken: () => mutations.changeToken,
  pushUndo: () => store.pushUndo(),
});

const defaultsEditor = (store: WidgetDefaultsStore): WidgetEditor => ({
  getWidget: (id) => store.getWidget(id),
  getSettings: <S extends WidgetSpecificSettings>(id: string) =>
    store.getSettings<S>(id),
  updateUserSettings: (id, partial) => store.updateUserSettings(id, partial),
  getChangeToken: () => store.changeToken,
  pushUndo: () => {},
});

const WidgetEditorContext = createContext<WidgetEditor | null>(null);

export const useWidgetEditor = (): WidgetEditor => {
  const context = use(WidgetEditorContext);
  // Nullable on purpose: outside the main window (the overlay's popup) an
  // editor is always provided, and the main root does not exist there.
  const mainRoot = use(MainRootContext);

  return useMemo(() => {
    if (context) return context;

    if (!mainRoot) {
      throw new Error(
        'A WidgetEditor must be provided outside the main window'
      );
    }

    return liveEditor(mainRoot.liveWidgets, mainRoot.settingsMutations);
  }, [context, mainRoot]);
};

// Binds descendant settings panels to an editor given by the caller — the
// overlay's popup, which writes through commands rather than the store.
export const WidgetEditorProvider = ({
  editor,
  children,
}: {
  editor: WidgetEditor;
  children: ReactNode;
}) => (
  <WidgetEditorContext.Provider value={editor}>
    {children}
  </WidgetEditorContext.Provider>
);

// Binds descendant settings panels / previews to the global widget defaults.
export const DefaultsEditorProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const store = useWidgetDefaultsStore();
  const editor = useMemo(() => defaultsEditor(store), [store]);

  return (
    <WidgetEditorContext.Provider value={editor}>
      {children}
    </WidgetEditorContext.Provider>
  );
};
