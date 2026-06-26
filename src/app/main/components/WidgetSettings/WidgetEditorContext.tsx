import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  BaseUserSettings,
  WidgetDefaultConfig,
  WidgetSpecificSettings,
  WidgetUserSettings,
} from '@/types/widget-settings';
import type { WidgetSettingsStore } from '@store/settings/widget-settings.store';
import { useWidgetSettingsStore } from '@store/root-store-context';

// A small editing target so the settings panels don't care WHAT they edit. The
// Widgets catalog binds this to the global defaults; everywhere else (layout
// editor, F9 overlay popup) falls back to the live active-layout store.
export interface WidgetEditor {
  getWidget(id: string): WidgetDefaultConfig | undefined;
  getSettings<SpecificSettings extends WidgetSpecificSettings>(
    id: string
  ): BaseUserSettings & SpecificSettings;
  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>): void;
  // Reactive change counter the preview reads to know when to re-mirror.
  getChangeToken(): number;
}

const liveEditor = (store: WidgetSettingsStore): WidgetEditor => ({
  getWidget: (id) => store.getWidget(id),
  getSettings: <S extends WidgetSpecificSettings>(id: string) =>
    store.getSettings<S>(id),
  updateUserSettings: (id, partial) => store.updateUserSettings(id, partial),
  getChangeToken: () => store.changeToken,
});

const defaultsEditor = (store: WidgetSettingsStore): WidgetEditor => ({
  getWidget: (id) => store.getDefaultWidget(id),
  getSettings: <S extends WidgetSpecificSettings>(id: string) =>
    store.getDefaultSettings<S>(id),
  updateUserSettings: (id, partial) =>
    store.updateDefaultUserSettings(id, partial),
  getChangeToken: () => store.defaultsChangeToken,
});

const WidgetEditorContext = createContext<WidgetEditor | null>(null);

export const useWidgetEditor = (): WidgetEditor => {
  const context = useContext(WidgetEditorContext);
  const store = useWidgetSettingsStore();

  return useMemo(() => context ?? liveEditor(store), [context, store]);
};

// Binds descendant settings panels / previews to the global widget defaults.
export const DefaultsEditorProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const store = useWidgetSettingsStore();
  const editor = useMemo(() => defaultsEditor(store), [store]);

  return (
    <WidgetEditorContext.Provider value={editor}>
      {children}
    </WidgetEditorContext.Provider>
  );
};
