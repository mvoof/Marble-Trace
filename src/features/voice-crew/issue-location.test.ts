import { describe, expect, it } from 'vitest';
import { questionIssueKey, questionIssuePlace } from './issue-location';

describe('questionIssuePlace', () => {
  it('reads an entry of a question list', () => {
    expect(questionIssuePlace('commands.custom.questions[2].noCar[1]')).toEqual(
      { question: 2, part: 'noCar', index: 1 }
    );
  });

  it('reads the question itself', () => {
    expect(questionIssuePlace('commands.custom.questions[0]')).toEqual({
      question: 0,
      part: null,
      index: null,
    });
  });

  it('leaves out what is not in a question', () => {
    expect(questionIssuePlace('commands.intents.pit.fuel[0]')).toBeNull();
    expect(questionIssuePlace('phrases.engineer.fuel[0]')).toBeNull();
    expect(
      questionIssuePlace('commands.custom.questions[0].other[1]')
    ).toBeNull();
  });
});

describe('questionIssueKey', () => {
  it('keys the question alone or an entry of it', () => {
    expect(questionIssueKey('fuel')).toBe('fuel');
    expect(questionIssueKey('fuel', 'steps', 3)).toBe('fuel:steps#3');
  });
});
