/** The last part of a path, either slash. */
export const fileName = (path: string): string =>
  path.split(/[\\/]/).at(-1) ?? path;
