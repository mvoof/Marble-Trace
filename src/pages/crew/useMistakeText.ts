import { useTranslation } from 'react-i18next';
import { questionIssuePlace } from '@features/voice-crew/issue-location';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import type {
  VoiceIssueView,
  VoiceMistake,
} from '@shared/contracts/generated/bindings';

/** Params that name a value, a slot or a field: said in braces, as typed. */
const BRACED_PARAMS = new Set([
  'slot',
  'field',
  'name',
  'found',
  'slots',
  'offered',
]);
/** Params that name a step's action: said by the action's title. */
const ACTION_PARAM = 'action';
const LIST_SEPARATOR = ', ';

/**
 * Pack mistakes in the user's language: what is wrong, and where — a
 * question by its name rather than its place in the file.
 */
export const useMistakeText = () => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  const paramText = (param: string, value: unknown): string => {
    const names = Array.isArray(value) ? value.map(String) : [String(value)];
    const shown = names.map((name) => {
      if (BRACED_PARAMS.has(param)) {
        return `{${name}}`;
      }

      if (param === ACTION_PARAM) {
        return t(`crewPage.actions.${name}.title`, { defaultValue: name });
      }

      return name;
    });

    return shown.join(LIST_SEPARATOR);
  };

  const mistakeText = (mistake: VoiceMistake): string => {
    const { code, ...params } = mistake;
    const key =
      mistake.code === 'noValueHere' && mistake.offered.length === 0
        ? 'noValueHereNone'
        : code;
    const values = Object.fromEntries(
      Object.entries(params).map(([param, value]) => [
        param,
        paramText(param, value),
      ])
    );

    return t(`crewPage.mistakes.${key}`, values);
  };

  const issueWhere = (issue: VoiceIssueView): string => {
    const place = questionIssuePlace(issue.location);
    const questionId = crew.issueQuestion(issue);
    const question =
      questionId === null ? undefined : crew.findQuestion(questionId);

    if (!place || !question) {
      return issue.location;
    }

    if (place.part === null) {
      return t('crewPage.mistakes.where.question', { name: question.name });
    }

    return t(`crewPage.mistakes.where.${place.part}`, {
      name: question.name,
      index: (place.index ?? 0) + 1,
    });
  };

  return { mistakeText, issueWhere };
};
