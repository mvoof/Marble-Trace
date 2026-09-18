import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Flex,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { TabletSmartphone } from 'lucide-react';

import { REMOTE_SCREEN_PRESET_GROUPS } from '@utils/remote-screen';
import { useLayoutsStore } from '@store/root-store-context';

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
  const layouts = useLayoutsStore();
  const { t } = useTranslation('main-app');

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [transparent, setTransparent] = useState(false);
  const [width, setWidth] = useState<number>(DEFAULT_PRESET.width);
  const [height, setHeight] = useState<number>(DEFAULT_PRESET.height);
  const [mode, setMode] = useState<'reuse' | 'new'>('new');
  const [selectedReusableSlug, setSelectedReusableSlug] = useState<string>('');

  const reusableScreens = layouts.reusableRemoteScreens;
  const hasReusable = reusableScreens.length > 0;

  const handleOpen = () => {
    setIsOpen(true);
    if (reusableScreens.length > 0) {
      setMode('reuse');
      setSelectedReusableSlug(reusableScreens[0]?.slug ?? '');
    } else {
      setMode('new');
    }
  };

  const presetOptions = REMOTE_SCREEN_PRESET_GROUPS.map((group) => ({
    label: t(`layoutEditor.remoteScreenPresetGroup.${group.id}`),
    options: group.presets.map((preset) => ({
      value: `${preset.width}x${preset.height}`,
      label: `${preset.label} · ${preset.width}×${preset.height}`,
    })),
  }));

  const handleConfirm = () => {
    if (hasReusable && mode === 'reuse') {
      const slug = selectedReusableSlug || reusableScreens[0]?.slug;
      if (slug) {
        layouts.addExistingRemoteScreen(slug);
      }
    } else {
      const trimmed = name.trim() || t('layoutEditor.remoteScreenDefaultName');

      layouts.addRemoteScreen(
        trimmed,
        width,
        height,
        transparent ? 'transparent' : undefined
      );
    }

    setIsOpen(false);
    setName('');
    setSelectedReusableSlug('');
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
          disabled={!layouts.editingLayout}
          onClick={handleOpen}
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
          {hasReusable && (
            <Radio.Group
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as 'reuse' | 'new')
              }
              optionType="button"
              buttonStyle="solid"
              options={[
                {
                  label: t('layoutEditor.remoteScreenModeReuse'),
                  value: 'reuse',
                },
                {
                  label: t('layoutEditor.remoteScreenModeNew'),
                  value: 'new',
                },
              ]}
            />
          )}

          {hasReusable && mode === 'reuse' ? (
            <>
              <Select
                placeholder={t('layoutEditor.remoteScreenSelectExisting')}
                value={selectedReusableSlug || reusableScreens[0]?.slug}
                onChange={setSelectedReusableSlug}
                options={reusableScreens.map((screen) => ({
                  value: screen.slug ?? '',
                  label: `${screen.name} · ${screen.bounds.width}×${screen.bounds.height}${screen.background === 'transparent' ? ` · ${t('layoutEditor.remoteScreenTransparentSuffix')}` : ''}`,
                }))}
              />

              <Typography.Text type="secondary">
                {t('layoutEditor.remoteScreenReuseHint')}
              </Typography.Text>
            </>
          ) : (
            <>
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
                  prefix="W"
                  onChange={(value) => value !== null && setWidth(value)}
                />

                <InputNumber
                  min={MIN_SIDE}
                  max={MAX_SIDE}
                  value={height}
                  prefix="H"
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
            </>
          )}
        </Flex>
      </Modal>
    </>
  );
});
