import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Clapperboard } from 'lucide-react';

import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { SESSION_PREVIEW_SCENARIOS } from '@features/preview/scenarios';

import { ToolbarButton } from './ToolbarButton';
import { ToolbarMenuItem } from './ToolbarMenuItem';
import { ToolbarPopover } from './ToolbarPopover';

/**
 * The moment the canvas draws its widgets against. The canvas is seeded as a
 * whole, so it offers the session-wide moments only — a widget's own domain
 * scenarios belong to that widget's picker.
 */
export const ScenarioPicker = observer(() => {
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');
  const current = SESSION_PREVIEW_SCENARIOS.find(
    (scenario) => scenario.id === editorUi.scenarioId
  );

  return (
    <ToolbarPopover
      align="end"
      trigger={({ isOpen, toggle }) => (
        <ToolbarButton
          icon={Clapperboard}
          label={current?.label}
          isLabelCollapsible
          title={t('layoutEditor.scenarioTooltip')}
          isSelect
          isExpanded={isOpen}
          onClick={toggle}
        />
      )}
    >
      {({ close }) =>
        SESSION_PREVIEW_SCENARIOS.map((scenario) => (
          <ToolbarMenuItem
            key={scenario.id}
            label={scenario.label}
            isChecked={scenario.id === editorUi.scenarioId}
            onClick={() => {
              editorUi.setScenario(scenario.id);
              close();
            }}
          />
        ))
      }
    </ToolbarPopover>
  );
});
