/** The lists of a question in `commands.json` a mistake can point into. */
export type QuestionPart =
  | 'phrases'
  | 'replies'
  | 'noCar'
  | 'noValue'
  | 'steps';

/** Where in a question a pack mistake is: the question itself, or one entry of a list. */
export interface QuestionIssuePlace {
  question: number;
  part: QuestionPart | null;
  index: number | null;
}

const QUESTION_LOCATION =
  /^commands\.custom\.questions\[(\d+)\](?:\.(phrases|replies|noCar|noValue|steps)\[(\d+)\])?$/;

/**
 * A pack mistake's location (`commands.custom.questions[2].replies[0]`) as
 * the question and the entry it names; `null` when it is not in a question.
 */
export const questionIssuePlace = (
  location: string
): QuestionIssuePlace | null => {
  const match = QUESTION_LOCATION.exec(location);

  if (!match) {
    return null;
  }

  const [, question, part, index] = match;

  return {
    question: Number(question),
    part: (part as QuestionPart | undefined) ?? null,
    index: index === undefined ? null : Number(index),
  };
};

/** The key a question's mistake is looked up by: its id, and the entry. */
export const questionIssueKey = (
  questionId: string,
  part: QuestionPart | null = null,
  index: number | null = null
) => (part === null ? questionId : `${questionId}:${part}#${index ?? 0}`);
