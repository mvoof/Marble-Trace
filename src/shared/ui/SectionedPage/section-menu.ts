import type { LucideIcon } from 'lucide-react';

/** A thin line between two runs of a page's inner menu. */
export const MENU_SEPARATOR = 'separator';

/** A section as the inner menu draws it. */
export interface MenuSection<SectionId extends string> {
  id: SectionId;
  label: string;
  /** Absent on a text-only menu. */
  icon?: LucideIcon;
  /** Shown but not selectable; `hint` says why. */
  disabled?: boolean;
  hint?: string;
}

/** One line of a page's inner menu: a section, or a separator. */
export type SectionMenuEntry<Section> = Section | typeof MENU_SEPARATOR;
