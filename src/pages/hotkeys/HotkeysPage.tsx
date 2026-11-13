import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { PageTitle } from '@shared/ui/PageTitle/PageTitle';

import { BindingSearch } from './BindingSearch';
import { BindingsSettings } from './BindingsSettings';
import { DevicesSettings } from './DevicesSettings';
import styles from './HotkeysPage.module.scss';

/** Bindings, with the devices they use beside them; no inner menu. */
export const HotkeysPage = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <div>
      <PageTitle
        title={t('appHeader.sections.hotkeys')}
        actions={<BindingSearch />}
      />

      <div className={styles.columns}>
        <div className={styles.pane}>
          <BindingsSettings />
        </div>

        <div className={styles.pane}>
          <DevicesSettings />
        </div>
      </div>
    </div>
  );
});
