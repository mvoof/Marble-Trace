/** Joins the class names that are set; `false`, `null`, `undefined` and `''` drop out. */
export const cx = (
  ...classNames: Array<string | false | null | undefined>
): string => classNames.filter(Boolean).join(' ');
