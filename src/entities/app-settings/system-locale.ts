export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'ru',
  'zh',
  'de',
  'fr',
  'pt-BR',
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

// navigator.language reflects the OS locale in Tauri's WebView2/WebKit shell,
// so no extra plugin is needed to read the system language.
export const detectSystemLanguage = (): SupportedLanguage => {
  const locale = navigator.language?.toLowerCase();
  const exactLanguage = SUPPORTED_LANGUAGES.find(
    (language) => language.toLowerCase() === locale
  );

  if (exactLanguage) {
    return exactLanguage;
  }

  const primary = locale?.split('-')[0];

  return (SUPPORTED_LANGUAGES as readonly string[]).includes(primary ?? '')
    ? (primary as SupportedLanguage)
    : FALLBACK_LANGUAGE;
};
