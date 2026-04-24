import React from 'react';

export interface WidgetVariant {
  component: React.ComponentType<{
    onVisibilityChange?: (visible: boolean) => void;
  }>;
  designWidth: number;
  designHeight: number;
  /** Use adaptive font-size scaling instead of transform: scale() */
  adaptive?: boolean;
}

export interface WidgetEntry {
  variants: Record<string, WidgetVariant>;
  defaultVariant: string;
}
