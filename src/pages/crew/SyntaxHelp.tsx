import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popover } from 'antd';
import { CircleHelp, ExternalLink } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import styles from './CrewPage.module.scss';

/** Each mark a sentence can hold, with an example and what it expands to. */
const MARKS = ['choice', 'optional', 'slot', 'nested'] as const;

/** Each mark only a reply holds: a value, and a number's word forms. */
const REPLY_MARKS = ['field', 'plural', 'exact'] as const;

interface SyntaxRowProps {
  example: string;
  title: string;
  desc: string;
}

const SyntaxRow = observer(({ example, title, desc }: SyntaxRowProps) => (
  <div className={styles.syntaxRow}>
    <code className={styles.syntaxExample}>{example}</code>

    <div>
      <div className={styles.fieldTitle}>{title}</div>

      <div className={styles.fieldDesc}>{desc}</div>
    </div>
  </div>
));

/** How a sentence is written, behind a help button until it is wanted. */
export const SyntaxHelp = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title={t('crewPage.syntax.title')}
      content={
        <div className={styles.syntaxHelp}>
          <div className={styles.fieldDesc}>{t('crewPage.syntax.intro')}</div>

          {MARKS.map((mark) => (
            <SyntaxRow
              key={mark}
              example={t(`crewPage.syntax.${mark}.example`)}
              title={t(`crewPage.syntax.${mark}.title`)}
              desc={t(`crewPage.syntax.${mark}.desc`)}
            />
          ))}

          <div className={styles.fieldTitle}>
            {t('crewPage.syntax.replies.title')}
          </div>

          <div className={styles.fieldDesc}>
            {t('crewPage.syntax.replies.intro')}
          </div>

          {REPLY_MARKS.map((mark) => (
            <SyntaxRow
              key={mark}
              example={t(`crewPage.syntax.replies.${mark}.example`)}
              title={t(`crewPage.syntax.replies.${mark}.title`)}
              desc={t(`crewPage.syntax.replies.${mark}.desc`)}
            />
          ))}

          <div className={styles.fieldDesc}>
            {t('crewPage.syntax.replies.forms')}
          </div>

          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={12} />}
            onClick={() => crew.openPluralRules()}
          >
            {t('crewPage.syntax.replies.rulesLink')}
          </Button>
        </div>
      }
    >
      <Button
        type="text"
        icon={<CircleHelp size={16} />}
        aria-label={t('crewPage.syntax.title')}
      />
    </Popover>
  );
});
