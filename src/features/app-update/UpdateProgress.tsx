import { Flex, Progress, Spin } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { useAppUpdateStore } from './app-update-context';

const BYTES_PER_KILOBYTE = 1000;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE ** 2;
const COMPLETE_PERCENT = 100;
const NON_BREAKING_SPACE = '\u00a0';

const formatBytes = (bytes: number, language: string): string => {
  if (bytes >= BYTES_PER_MEGABYTE) {
    return (bytes / BYTES_PER_MEGABYTE).toLocaleString(language, {
      style: 'unit',
      unit: 'megabyte',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  if (bytes >= BYTES_PER_KILOBYTE) {
    return (bytes / BYTES_PER_KILOBYTE).toLocaleString(language, {
      style: 'unit',
      unit: 'kilobyte',
      maximumFractionDigits: 0,
    });
  }

  return bytes.toLocaleString(language, { style: 'unit', unit: 'byte' });
};

export const UpdateProgress = observer(() => {
  const { downloadProgress } = useAppUpdateStore();
  const { t, i18n } = useTranslation('main-app');
  const { downloadedBytes = 0, totalBytes, finished } = downloadProgress ?? {};

  if (finished) {
    return <Spin size="small" />;
  }

  const downloaded = formatBytes(downloadedBytes, i18n.language);

  if (!totalBytes) {
    return (
      <Flex align="center" gap="small">
        <Spin size="small" />
        <FixedDigits text={downloaded.replaceAll(' ', NON_BREAKING_SPACE)} />
      </Flex>
    );
  }

  const percent = Math.min(
    COMPLETE_PERCENT,
    (downloadedBytes / totalBytes) * COMPLETE_PERCENT
  );
  const total = formatBytes(totalBytes, i18n.language);
  const size = `${downloaded} / ${total}`.replaceAll(' ', NON_BREAKING_SPACE);

  return (
    <Flex vertical>
      <Progress
        aria-label={t('updateBanner.downloading')}
        percent={percent}
        showInfo={false}
        size="small"
        status="normal"
      />
      <FixedDigits text={size} />
    </Flex>
  );
});
