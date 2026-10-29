import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popover } from 'antd';
import { CircleHelp } from 'lucide-react';
import styles from './CrewPage.module.scss';

/** Each mark a sentence can hold, with an example and what it expands to. */
const MARKS = ['choice', 'optional', 'slot', 'nested'] as const;

/** How a sentence is written, behind a help button until it is wanted. */
export const SyntaxHelp = observer(() => {
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
            <div className={styles.syntaxRow} key={mark}>
              <code className={styles.syntaxExample}>
                {t(`crewPage.syntax.${mark}.example`)}
              </code>

              <div>
                <div className={styles.fieldTitle}>
                  {t(`crewPage.syntax.${mark}.title`)}
                </div>

                <div className={styles.fieldDesc}>
                  {t(`crewPage.syntax.${mark}.desc`)}
                </div>
              </div>
            </div>
          ))}

          <div className={styles.fieldDesc}>{t('crewPage.syntax.replies')}</div>
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
