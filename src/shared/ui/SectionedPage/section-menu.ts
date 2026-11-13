import type { LucideIcon } from 'lucide-react';

/** A thin line between two runs of a page's inner menu. */
export const MENU_SEPARATOR = 'separator';

/** A section as the inner menu draws it. */
export interface MenuSection<SectionId extends string> {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

/** One line of a page's inner menu: a section, or a separator. */
export type SectionMenuEntry<Section> = Section | typeof MENU_SEPARATOR;
