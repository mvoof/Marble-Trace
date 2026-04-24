import React from 'react';

export interface WidgetVariant {
  component: React.ComponentType<{
    onVisibilityChange?: (visible: boolean) => void;
  }>;
  designWidth: number;
  designHeight: number;
  /** Scale widget via transform: scale() based on designWidth/designHeight. false = stretch to fill container with no scaling */
  scale?: boolean;
}

export interface WidgetEntry {
  variants: Record<string, WidgetVariant>;
  defaultVariant: string;
}
