import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Clapperboard } from 'lucide-react';

import { ToolbarButton } from '@shared/ui/Toolbar/ToolbarButton';
import { ToolbarMenuItem } from '@shared/ui/Toolbar/ToolbarMenuItem';
import { ToolbarPopover } from '@shared/ui/Toolbar/ToolbarPopover';

import type { ScenarioOption } from './widget-scenarios';

interface WidgetScenarioPickerProps {
  options: ScenarioOption[];
  value: string;
  onChange: (scenarioId: string) => void;
}

/** The state the widget's preview draws, picked the way the layout editor picks one. */
export const WidgetScenarioPicker = observer(
  ({ options, value, onChange }: WidgetScenarioPickerProps) => {
    const { t } = useTranslation('main-app');
    const current = options.find((option) => option.value === value);

    return (
      <ToolbarPopover
        align="end"
        trigger={({ isOpen, toggle }) => (
          <ToolbarButton
            icon={Clapperboard}
            label={current?.label}
            title={t('layoutEditor.scenarioTooltip')}
            isSelect
            isExpanded={isOpen}
            onClick={toggle}
          />
        )}
      >
        {({ close }) =>
          options.map((option) => (
            <ToolbarMenuItem
              key={option.value}
              label={option.label}
              isChecked={option.value === value}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            />
          ))
        }
      </ToolbarPopover>
    );
  }
);
