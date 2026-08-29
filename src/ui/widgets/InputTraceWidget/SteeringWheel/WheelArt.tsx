import type { FunctionComponent, SVGProps } from 'react';

import type { SteeringWheelStyle } from '@/types/widget-settings';
import FormulaCompact from '@assets/wheels/formula-compact.svg?react';
import FormulaConspit from '@assets/wheels/formula-conspit.svg?react';
import FormulaConspitPro from '@assets/wheels/formula-conspit-pro.svg?react';
import FormulaGtHybrid from '@assets/wheels/formula-gt-hybrid.svg?react';
import FormulaOpen from '@assets/wheels/formula-open.svg?react';
import GtRound from '@assets/wheels/gt-round.svg?react';
import FlatBottom from '@assets/wheels/flat-bottom-wheel.svg?react';
import Bagel from '@assets/wheels/bagel.svg?react';

type WheelArtComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

/**
 * Silhouettes traced from wheel photographs — a square viewBox each, so a
 * single square slot holds every one of them at the same scale, and
 * `fill="currentColor"` lets the widget's own text color drive them.
 */
const WHEEL_ART: Partial<Record<SteeringWheelStyle, WheelArtComponent>> = {
  'gt-round': GtRound,
  'flat-bottom': FlatBottom,
  bagel: Bagel,
  'formula-open': FormulaOpen,
  'formula-compact': FormulaCompact,
  'formula-conspit': FormulaConspit,
  'formula-conspit-pro': FormulaConspitPro,
  'formula-gt-hybrid': FormulaGtHybrid,
};

export const getWheelArt = (
  style: SteeringWheelStyle
): WheelArtComponent | undefined => WHEEL_ART[style];
