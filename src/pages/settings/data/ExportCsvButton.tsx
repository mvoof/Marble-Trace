import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button } from 'antd';
import { FileDown } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';

const ICON_SIZE = 14;

/** Writes every session record to a CSV file the driver picks. */
export const ExportCsvButton = observer(() => {
  const { t } = useTranslation('main-app');
  const { message } = App.useApp();
  const statistics = useStatisticsStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      const written = await statistics.exportCsv();

      if (written !== null) {
        message.success(
          t('dataPage.statistics.exported', { count: written.count })
        );
      }
    } catch (error) {
      message.error(
        t('dataPage.statistics.exportFailed', { reason: String(error) })
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      icon={<FileDown size={ICON_SIZE} />}
      loading={exporting}
      onClick={() => void handleExport()}
    >
      {t('dataPage.statistics.exportCsv')}
    </Button>
  );
});
