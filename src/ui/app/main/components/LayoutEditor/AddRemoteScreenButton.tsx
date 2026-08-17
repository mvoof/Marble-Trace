import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, InputNumber, Modal, Select, Tooltip } from 'antd';
import { TabletSmartphone } from 'lucide-react';

import { REMOTE_SCREEN_PRESETS } from '@utils/remote-screen';
import { useWidgetSettingsStore } from '@store/root-store-context';

const ICON_SIZE = 12;
const MIN_SIDE = 240;
const MAX_SIDE = 4096;

const DEFAULT_PRESET = REMOTE_SCREEN_PRESETS[0];

/**
 * Adds a device screen to the layout.
 *
 * The size is picked here and stored with the layout rather than read from the
 * device: the editor has to work with the tablet switched off and in another
 * room, so the screen needs bounds of its own long before anything connects.
 */
export const AddRemoteScreenButton = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const { t } = useTranslation('main-app');

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [width, setWidth] = useState<number>(DEFAULT_PRESET.width);
  const [height, setHeight] = useState<number>(DEFAULT_PRESET.height);

  const presetOptions = REMOTE_SCREEN_PRESETS.map((preset) => ({
    value: `${preset.width}x${preset.height}`,
    label: `${preset.label} · ${preset.width}×${preset.height}`,
  }));

  const handleConfirm = () => {
    const trimmed = name.trim() || t('layoutEditor.remoteScreenDefaultName');

    widgetSettings.addRemoteScreen(trimmed, width, height);

    setIsOpen(false);
    setName('');
  };

  const handlePreset = (value: string) => {
    const [presetWidth, presetHeight] = value.split('x').map(Number);

    setWidth(presetWidth);
    setHeight(presetHeight);
  };

  return (
    <>
      <Tooltip title={t('layoutEditor.addRemoteScreenTooltip')}>
        <Button
          size="small"
          icon={<TabletSmartphone size={ICON_SIZE} />}
          disabled={!widgetSettings.activeLayout}
          onClick={() => setIsOpen(true)}
        >
          {t('layoutEditor.addRemoteScreen')}
        </Button>
      </Tooltip>

      <Modal
        open={isOpen}
        title={t('layoutEditor.addRemoteScreen')}
        okText={t('layoutEditor.addRemoteScreenConfirm')}
        onOk={handleConfirm}
        onCancel={() => setIsOpen(false)}
      >
        <Flex vertical gap={12}>
          <Input
            placeholder={t('layoutEditor.remoteScreenNamePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <Select
            options={presetOptions}
            defaultValue={presetOptions[0].value}
            onChange={handlePreset}
          />

          <Flex gap={8}>
            <InputNumber
              min={MIN_SIDE}
              max={MAX_SIDE}
              value={width}
              addonBefore="W"
              onChange={(value) => value !== null && setWidth(value)}
            />

            <InputNumber
              min={MIN_SIDE}
              max={MAX_SIDE}
              value={height}
              addonBefore="H"
              onChange={(value) => value !== null && setHeight(value)}
            />
          </Flex>
        </Flex>
      </Modal>
    </>
  );
});
