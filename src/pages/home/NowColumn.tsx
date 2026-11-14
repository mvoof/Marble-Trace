import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useSimStore } from '@entities/sim/sim-context';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { cx } from '@shared/lib/class-names';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { nowSummary } from './now-summary';
import styles from './NowColumn.module.scss';

interface NowRowProps {
  label: string;
  children: ReactNode;
}

const NowRow = ({ label, children }: NowRowProps) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>

    {children}
  </div>
);

/** What is on right now: the game, the layout on screen and what it shows. */
export const NowColumn = observer(() => {
  const { t } = useTranslation('main-app');
  const sim = useSimStore();
  const layouts = useLayoutsStore();
  const navigation = useMainNavigationStore();

  const isConnected = sim.status === 'connected';
  const summary = nowSummary(layouts.liveLayout);

  const handleOpenLayouts = () => navigation.open('layouts');

  return (
    <aside className={styles.column}>
      <SettingsCard title={t('homePage.now.title')}>
        <NowRow label={t('homePage.now.sim')}>
          <span className={styles.chip}>
            <span className={cx(styles.dot, isConnected && styles.dotOn)} />
            {isConnected
              ? t('homePage.now.connected')
              : t('homePage.now.notRunning')}
          </span>
        </NowRow>

        <NowRow label={t('homePage.now.layout')}>
          <button
            type="button"
            className={styles.chip}
            onClick={handleOpenLayouts}
            title={t('homePage.now.openLayouts')}
          >
            <span className={styles.chipText}>
              {summary.layoutName ?? t('homePage.now.noLayout')}
            </span>
          </button>
        </NowRow>

        <NowRow label={t('homePage.now.monitors')}>
          <span className={styles.value}>{summary.monitors}</span>
        </NowRow>

        <NowRow label={t('homePage.now.widgetsOn')}>
          <span className={styles.value}>{summary.widgetsOn}</span>
        </NowRow>

        <NowRow label={t('homePage.now.browserScreens')}>
          <span className={styles.value}>{summary.browserScreens}</span>
        </NowRow>
      </SettingsCard>
    </aside>
  );
});
