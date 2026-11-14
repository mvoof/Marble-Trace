import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { directionOf } from '@features/statistics/home-stats';
import type { CategoryRating } from '@shared/contracts/generated/bindings';
import {
  categoryLook,
  changeLabel,
  licenceClass,
  useCategoryName,
} from './home-format';
import styles from './RatingsCard.module.scss';

const ICON_SIZE = 14;
const MS_PER_SECOND = 1000;

interface RatingRowProps {
  rating: CategoryRating;
  selected: boolean;
}

const RatingRow = observer(({ rating, selected }: RatingRowProps) => {
  const { t, i18n } = useTranslation('main-app');
  const statistics = useStatisticsStore();
  const look = categoryLook(rating.category);
  const CategoryIcon = look?.icon;
  const name = useCategoryName(rating.category);
  const numberFormat = new Intl.NumberFormat(i18n.language);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  });

  const handleClick = () => statistics.selectChartCategory(rating.category);

  return (
    <button
      type="button"
      className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
      title={t('homePage.ratings.showInChart', { category: name })}
      aria-pressed={selected}
      onClick={handleClick}
    >
      <span className={styles.category}>
        {CategoryIcon && <CategoryIcon size={ICON_SIZE} />}
        {name}
      </span>

      {rating.licence === null ? (
        <span />
      ) : (
        <span
          className={`${styles.licence} ${styles[`lic${licenceClass(rating.licence)}`]}`}
        >
          {rating.licence}
        </span>
      )}

      <span className={`${styles.figure} ${styles.irating}`}>
        {numberFormat.format(rating.irating)}
      </span>

      <span
        className={`${styles.figure} ${styles.small} ${styles[directionOf(rating.weekChange)]}`}
        title={t('homePage.ratings.weekChange')}
      >
        {changeLabel(rating.weekChange)}
      </span>

      <span className={`${styles.small} ${styles.lastSession}`}>
        {dateFormat.format(new Date(rating.lastSessionAt * MS_PER_SECOND))}
      </span>
    </button>
  );
});

/** Licence and iRating, one line per category driven; a line picks the chart's. */
export const RatingsCard = observer(() => {
  const { t } = useTranslation('main-app');
  const statistics = useStatisticsStore();
  const chosen = statistics.chartRating;

  return (
    <div className={styles.card}>
      <div className={styles.label}>
        <TrendingUp size={ICON_SIZE} />
        {t('homePage.ratings.title')}
        <span className={styles.labelAside}>
          {t('homePage.ratings.byCategory')}
        </span>
      </div>

      {statistics.ratings.length === 0 ? (
        <p className={styles.none}>{t('homePage.ratings.none')}</p>
      ) : (
        statistics.ratings.map((rating) => (
          <RatingRow
            key={rating.category}
            rating={rating}
            selected={rating.category === chosen?.category}
          />
        ))
      )}
    </div>
  );
});
