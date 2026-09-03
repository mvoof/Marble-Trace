import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Flex,
  Input,
  InputNumber,
  Modal,
  Switch,
  Typography,
  Select,
  Tooltip,
} from 'antd';
import { TabletSmartphone } from 'lucide-react';

import { REMOTE_SCREEN_PRESET_GROUPS } from '@utils/remote-screen';
import { useWidgetSettingsStore } from '@store/root-store-context';

const ICON_SIZE = 12;
const MIN_SIDE = 240;
const MAX_SIDE = 4096;

const DEFAULT_PRESET = REMOTE_SCREEN_PRESET_GROUPS[0].presets[0];

/**
 * Adds a screen to the layout.
 *
 * One kind of screen, whoever opens it: a tablet in the garage and a browser
 * source in OBS read the same page, and the only thing that differs is what it
 * paints behind the widgets. So the dialog asks for a name, a size and whether
 * the ground is transparent — never for what the screen is *for*.
 *
 * The size is stored with the layout rather than read from whatever connects:
 * the editor has to work with the tablet switched off and in another room, so
 * the screen needs bounds of its own long before anything opens it.
 */
export const AddRemoteScreenButton = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const { t } = useTranslation('main-app');

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [transparent, setTransparent] = useState(false);
  const [width, setWidth] = useState<number>(DEFAULT_PRESET.width);
  const [height, setHeight] = useState<number>(DEFAULT_PRESET.height);

  const presetOptions = REMOTE_SCREEN_PRESET_GROUPS.map((group) => ({
    label: t(`layoutEditor.remoteScreenPresetGroup.${group.id}`),
    options: group.presets.map((preset) => ({
      value: `${preset.width}x${preset.height}`,
      label: `${preset.label} · ${preset.width}×${preset.height}`,
    })),
  }));

  const handleConfirm = () => {
    const trimmed = name.trim() || t('layoutEditor.remoteScreenDefaultName');

    widgetSettings.addRemoteScreen(
      trimmed,
      width,
      height,
      transparent ? 'transparent' : undefined
    );

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
        cancelText={t('layoutEditor.cancel')}
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
            value={`${width}x${height}`}
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

          <Flex align="center" gap={12}>
            <Switch checked={transparent} onChange={setTransparent} />

            <Typography.Text>
              {t('layoutEditor.remoteScreenTransparent')}
            </Typography.Text>
          </Flex>

          <Typography.Text type="secondary">
            {t('layoutEditor.addRemoteScreenHint')}
          </Typography.Text>
        </Flex>
      </Modal>
    </>
  );
});
