/**
 * The nine places the quick-placement grid can drop a widget on its screen.
 *
 * Its own file because both halves of the editor need it: the toolbar that
 * offers the corners and the editor that computes them.
 */
export type SnapPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'midLeft'
  | 'center'
  | 'midRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';
