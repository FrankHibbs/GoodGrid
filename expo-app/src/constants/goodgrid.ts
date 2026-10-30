export const palette = {
  background: '#f6f2e8',
  paper: '#fffefa',
  ink: '#292b27',
  muted: '#85877e',
  sage: '#657a61',
  sageDark: '#52694f',
  sageSoft: '#eaf0e5',
  border: '#e6e1d5',
  panel: '#f3f1e9',
  symbols: ['#4d8188', '#b47749', '#7c72a0', '#788b58', '#b56e86', '#6983a5', '#ab884a', '#6c806d', '#9c719c'],
};

export const sizes = [3, 4, 5] as const;
export type BoxSize = (typeof sizes)[number];
export type Difficulty = 'easy' | 'medium' | 'hard';

export function boardLabel(boxSize: BoxSize) {
  const side = boxSize * boxSize;
  return `${boxSize}×${boxSize} boxes · ${side}×${side} board`;
}
