export const appDataDir = async (): Promise<string> => '/mock/app-data';

export const join = async (...parts: string[]): Promise<string> =>
  parts.join('/');
