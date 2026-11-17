import { describe, expect, it } from 'vitest';

import { fileName } from './file-name';

describe('fileName', () => {
  it('takes the last part of a Windows or a forward-slash path', () => {
    expect(fileName('D:\\Documents\\iRacing\\telemetry\\cut.ibt')).toBe(
      'cut.ibt'
    );
    expect(fileName('D:/telemetry/cut.ibt')).toBe('cut.ibt');
    expect(fileName('cut.ibt')).toBe('cut.ibt');
  });
});
