/**
 * The blocks with the one at `from` put before the block that stood at
 * `before`; the blocks' length puts it last.
 */
export const movedBefore = <Block>(
  blocks: Block[],
  from: number,
  before: number
): Block[] => {
  if (before === from || before === from + 1) {
    return blocks;
  }

  const moving = blocks[from];
  const rest = blocks.filter((_, index) => index !== from);
  const insertAt = before > from ? before - 1 : before;

  return [...rest.slice(0, insertAt), moving, ...rest.slice(insertAt)];
};
