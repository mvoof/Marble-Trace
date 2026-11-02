/**
 * The word that agrees with a number in a crew reply — "1 литр, 3 литра,
 * 5 литров" — written as the pack stores it, `{liters, plural, one {# литр}
 * few {# литра} …}`, so nobody has to type that by hand.
 */

export type PluralForm = Intl.LDMLPluralRule;

const FORM_ORDER: PluralForm[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
/** Numbers tried, in order, for one that shows a form: whole first, a fraction last. */
const SAMPLE_CANDIDATES = [1, 2, 3, 5, 0, 1.5];

/**
 * The forms a word takes beside a number in the language, in CLDR order —
 * only those a reply's number can take: Spanish `many` is for millions.
 */
export const pluralForms = (language: string): PluralForm[] => {
  const rules = new Intl.PluralRules(language);
  const forms = rules.resolvedOptions().pluralCategories;

  return FORM_ORDER.filter(
    (form) =>
      forms.includes(form) &&
      SAMPLE_CANDIDATES.some((candidate) => rules.select(candidate) === form)
  );
};

/** A number that takes the form, to label it: 1 for `one`, 5 for `many`. */
export const pluralSample = (language: string, form: PluralForm): number => {
  const rules = new Intl.PluralRules(language);

  return (
    SAMPLE_CANDIDATES.find((candidate) => rules.select(candidate) === form) ?? 0
  );
};

/** `{value, plural, …}` with the number before each form's word. */
export const pluralMessage = (
  value: string,
  words: Partial<Record<PluralForm, string>>
): string => {
  const cases = FORM_ORDER.filter((form) => words[form] !== undefined)
    .map((form) => `${form} {# ${words[form]?.trim() ?? ''}}`)
    .join(' ');

  return `{${value}, plural, ${cases}}`;
};
