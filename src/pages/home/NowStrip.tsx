import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useSimStore } from '@entities/sim/sim-context';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { cx } from '@shared/lib/class-names';
import { nowSummary } from './now-summary';
import styles from './NowStrip.module.scss';

interface NowItemProps {
  label: string;
  children: ReactNode;
}

const NowItem = ({ label, children }: NowItemProps) => (
  <div className={styles.item}>
    <span className={styles.label}>{label}</span>

    {children}
  </div>
);

/** What is on right now, in one line: the game, the layout on screen and what it shows. */
export const NowStrip = observer(() => {
  const { t } = useTranslation('main-app');
  const sim = useSimStore();
  const layouts = useLayoutsStore();
  const navigation = useMainNavigationStore();

  const isConnected = sim.status === 'connected';
  const summary = nowSummary(layouts.liveLayout);

  const handleOpenLayouts = () => navigation.open('layouts');

  return (
    <section className={styles.strip}>
      <span className={styles.title}>{t('homePage.now.title')}</span>

      <NowItem label={t('homePage.now.sim')}>
        <span className={styles.value}>
          <span className={cx(styles.dot, isConnected && styles.dotOn)} />
          {isConnected
            ? t('homePage.now.connected')
            : t('homePage.now.notRunning')}
        </span>
      </NowItem>

      <NowItem label={t('homePage.now.layout')}>
        <button
          type="button"
          className={styles.layout}
          onClick={handleOpenLayouts}
          title={t('homePage.now.openLayouts')}
        >
          {summary.layoutName ?? t('homePage.now.noLayout')}
        </button>
      </NowItem>

      <NowItem label={t('homePage.now.monitors')}>
        <span className={styles.number}>{summary.monitors}</span>
      </NowItem>

      <NowItem label={t('homePage.now.widgetsOn')}>
        <span className={styles.number}>{summary.widgetsOn}</span>
      </NowItem>

      <NowItem label={t('homePage.now.browserScreens')}>
        <span className={styles.number}>{summary.browserScreens}</span>
      </NowItem>
    </section>
  );
});
