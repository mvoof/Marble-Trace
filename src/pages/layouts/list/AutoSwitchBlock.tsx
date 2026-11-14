import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select, Switch } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useSessionStore } from '@entities/session/session-context';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import type { KnownCar } from '@shared/contracts/generated/bindings';
import type {
  AutoSwitchRule,
  SessionContext,
} from '@shared/contracts/widget-settings';

import { SESSION_CONTEXTS, SESSION_LOOKS } from './session-labels';
import { carNameOf, ruleCars, ruleClasses } from './rule-options';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';

import styles from './AutoSwitchBlock.module.scss';

// Ant's Select takes no null value: "any" travels as this and back.
const ANY = '';

const fromSelect = (value: string): string | null =>
  value === ANY ? null : value;

interface RuleRowProps {
  rule: AutoSwitchRule;
  cars: KnownCar[];
  classes: string[];
  layoutOptions: { value: string; label: string }[];
}

const RuleRow = observer(
  ({ rule, cars, classes, layoutOptions }: RuleRowProps) => {
    const layouts = useLayoutsStore();
    const { t } = useTranslation('main-app');

    const contextOptions = [
      { value: ANY, label: t('layoutList.autoSwitch.anySession') },
      ...SESSION_CONTEXTS.map((context) => ({
        value: context,
        label: t(SESSION_LOOKS[context].labelKey),
      })),
    ];
    const classOptions = [
      { value: ANY, label: t('layoutList.autoSwitch.anyClass') },
      ...classes.map((name) => ({ value: name, label: name })),
    ];
    const carLabel = (carId: number): string =>
      carNameOf(cars, carId) ??
      t('layoutList.autoSwitch.carById', { id: carId });
    const carsOfClass = cars.filter(
      (car) => rule.carClass === null || car.carClass === rule.carClass
    );
    const hasOwnCar =
      rule.carId === null ||
      carsOfClass.some((car) => car.carId === rule.carId);
    const carOptions = [
      { value: ANY, label: t('layoutList.autoSwitch.anyCar') },
      ...carsOfClass.map((car) => ({
        value: String(car.carId),
        label: carLabel(car.carId),
      })),
      // A car of no recorded session, or of another class, stays readable.
      ...(hasOwnCar
        ? []
        : [
            {
              value: String(rule.carId),
              label: carLabel(rule.carId as number),
            },
          ]),
    ];

    const handleContextChange = (value: string) => {
      layouts.updateAutoSwitchRule(rule.id, {
        context: fromSelect(value) as SessionContext | null,
      });
    };

    const handleClassChange = (value: string) => {
      layouts.updateAutoSwitchRule(rule.id, { carClass: fromSelect(value) });
    };

    const handleCarChange = (value: string) => {
      const carId = fromSelect(value);

      layouts.updateAutoSwitchRule(rule.id, {
        carId: carId === null ? null : Number(carId),
      });
    };

    return (
      <div className={styles.rule}>
        <div className={styles.conditions}>
          <Select
            value={rule.context ?? ANY}
            options={contextOptions}
            onChange={handleContextChange}
            aria-label={t('layoutList.autoSwitch.session')}
          />
          <Select
            showSearch
            value={rule.carClass ?? ANY}
            options={classOptions}
            onChange={handleClassChange}
            aria-label={t('layoutList.autoSwitch.carClass')}
          />
          <Select
            showSearch
            optionFilterProp="label"
            value={rule.carId === null ? ANY : String(rule.carId)}
            options={carOptions}
            onChange={handleCarChange}
            aria-label={t('layoutList.autoSwitch.car')}
          />
        </div>

        <span className={styles.arrow} aria-hidden>
          →
        </span>

        <Select
          className={styles.layoutSelect}
          value={rule.layoutId}
          options={layoutOptions}
          onChange={(layoutId: string) =>
            layouts.updateAutoSwitchRule(rule.id, { layoutId })
          }
          aria-label={t('layoutList.autoSwitch.layout')}
        />

        <Button
          type="text"
          icon={<Trash2 size={16} />}
          onClick={() => layouts.removeAutoSwitchRule(rule.id)}
          aria-label={t('layoutList.autoSwitch.removeRule')}
        />
      </div>
    );
  }
);

/**
 * Which layout goes on screen in which situation in the sim — a session, a car
 * class, a car — and the switch for the whole thing. The one place a layout is
 * assigned. The most specific matching rule wins.
 */
export const AutoSwitchBlock = observer(() => {
  const layouts = useLayoutsStore();
  const appSettings = useAppSettingsStore();
  const session = useSessionStore();
  const statistics = useStatisticsStore();
  const { t } = useTranslation('main-app');
  const isEnabled = appSettings.appSettings.autoSwitchLayouts;

  const cars = ruleCars(session.fieldCars, statistics.knownCars);
  const classes = ruleClasses(cars, layouts.autoSwitchRules);
  const layoutOptions = layouts.layouts.map((layout) => ({
    value: layout.id,
    label: layout.name,
  }));
  const firstLayoutId = layouts.liveLayoutId ?? layouts.layouts[0]?.id;

  return (
    <SettingsCard
      title={t('layoutList.autoSwitch.title')}
      extra={
        <label className={styles.masterSwitch}>
          <span>{t('layoutList.autoSwitch.enabled')}</span>
          <Switch
            size="small"
            checked={isEnabled}
            onChange={(checked) =>
              appSettings.update({ autoSwitchLayouts: checked })
            }
          />
        </label>
      }
    >
      <p className={styles.description}>
        {t('layoutList.autoSwitch.description')}
      </p>

      <div className={styles.rules}>
        {layouts.autoSwitchRules.length === 0 ? (
          <p className={styles.empty}>{t('layoutList.autoSwitch.noRules')}</p>
        ) : (
          layouts.autoSwitchRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              cars={cars}
              classes={classes}
              layoutOptions={layoutOptions}
            />
          ))
        )}
      </div>

      <Button
        className={styles.addRule}
        icon={<Plus size={16} />}
        disabled={!firstLayoutId}
        onClick={() =>
          firstLayoutId && layouts.addAutoSwitchRule(firstLayoutId)
        }
      >
        {t('layoutList.autoSwitch.addRule')}
      </Button>
    </SettingsCard>
  );
});
