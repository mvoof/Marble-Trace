import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { initDiagnosticsHudSync } from '@platform/sync/diagnostics-hud-sync';
import { useDiagnosticsHudStore, useStore } from '@store/root-store-context';
import { DiagnosticsBanner } from './DiagnosticsBanner';

/**
 * The window shell for the in-game diagnostics banner. Its own Tauri window, so
 * it carries its own store instance and receives the run state over an event.
 */
export const DiagnosticsHudWindow = observer(() => {
  const root = useStore();
  const hud = useDiagnosticsHudStore();
  const { i18n } = useTranslation();
  const language = hud.state?.language;

  // This window never reads the settings file, so the language arrives with the
  // first state payload rather than at boot.
  useEffect(() => {
    if (language !== undefined && language !== i18n.language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    void initDiagnosticsHudSync(root).then((dispose) => {
      if (cancelled) {
        dispose();

        return;
      }

      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [root, i18n]);

  return <DiagnosticsBanner />;
});
