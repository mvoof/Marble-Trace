export const SUPPORTED_LANGUAGES = ['en', 'ru', 'zh'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

// navigator.language reflects the OS locale in Tauri's WebView2/WebKit shell,
// so no extra plugin is needed to read the system language.
export const detectSystemLanguage = (): SupportedLanguage => {
  const primary = navigator.language?.split('-')[0]?.toLowerCase();

  return (SUPPORTED_LANGUAGES as readonly string[]).includes(primary ?? '')
    ? (primary as SupportedLanguage)
    : FALLBACK_LANGUAGE;
};
