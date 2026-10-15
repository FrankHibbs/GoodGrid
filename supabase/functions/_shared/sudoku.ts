const SYMBOLS = "123456789ABCDEFGHIJKLMNOP";
const MEDIUM_CLUES: Record<number, number> = { 3: 32, 4: 155, 5: 425 };

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function shuffledIndexes(boxSize: number, random: () => number): number[] {
  return shuffled(Array.from({ length: boxSize }, (_, index) => index), random)
    .flatMap(group => shuffled(Array.from({ length: boxSize }, (_, index) => group * boxSize + index), random));
}

export function createDailyPuzzle(boxSize: number, challengeDate: string) {
  const side = boxSize * boxSize;
  const random = seededRandom(`${challengeDate}:${boxSize}:good-grid-medium-v1`);
  const rows = shuffledIndexes(boxSize, random);
  const columns = shuffledIndexes(boxSize, random);
  const symbols = shuffled(Array.from({ length: side }, (_, index) => index), random);
  const solution = rows.map(row => columns.map(column => symbols[
    (boxSize * (row % boxSize) + Math.floor(row / boxSize) + column) % side
  ]));
  const puzzle = solution.map(row => [...row]);
  const positions = shuffled(Array.from({ length: side * side }, (_, index) => index), random);
  for (const position of positions.slice(MEDIUM_CLUES[boxSize])) {
    puzzle[Math.floor(position / side)][position % side] = -1;
  }
  return { puzzle, solution };
}

export function isBoxSize(value: unknown): value is 3 | 4 | 5 {
  return value === 3 || value === 4 || value === 5;
}
