import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { Difficulty } from '@/constants/goodgrid';

export type PuzzleData = { solution: number[]; clues: number[] };
export type PuzzleSnapshot = { values: number[]; notes: number[][] };
export type CasualProgress = {
  version: 1;
  boxSize: number;
  difficulty: Difficulty;
  puzzle: PuzzleData;
  values: number[];
  notes: number[][];
  history: PuzzleSnapshot[];
  seconds: number;
  showMistakes: boolean;
  completed: boolean;
};

const STORAGE_KEY = 'goodgrid.casual-progress.v1';

function readStoredValue() {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  return AsyncStorage.getItem(STORAGE_KEY);
}

function writeStoredValue(value: string) {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, value);
    } catch {
      // Storage can be unavailable in private browsing or when the quota is full.
    }
    return Promise.resolve();
  }

  return AsyncStorage.setItem(STORAGE_KEY, value);
}

export async function loadCasualProgress(): Promise<CasualProgress | null> {
  try {
    const raw = await readStoredValue();
    if (!raw) return null;

    const progress = JSON.parse(raw) as CasualProgress;
    const side = progress.boxSize * progress.boxSize;
    const cellCount = side * side;
    const validNumberArray = (items: unknown): items is number[] =>
      Array.isArray(items) && items.length === cellCount && items.every(value => Number.isInteger(value) && value >= -1 && value < side);

    if (
      progress.version !== 1 ||
      ![3, 4, 5].includes(progress.boxSize) ||
      !['easy', 'medium', 'hard'].includes(progress.difficulty) ||
      !progress.puzzle ||
      !validNumberArray(progress.puzzle.solution) ||
      !validNumberArray(progress.puzzle.clues) ||
      !validNumberArray(progress.values) ||
      !Array.isArray(progress.notes) ||
      progress.notes.length !== cellCount ||
      !Array.isArray(progress.history) ||
      !Number.isFinite(progress.seconds) ||
      progress.seconds < 0
    ) {
      return null;
    }

    if (!progress.notes.every(cellNotes => Array.isArray(cellNotes) && cellNotes.every(value => Number.isInteger(value) && value >= 0 && value < side))) return null;
    if (!progress.history.every(snapshot => validNumberArray(snapshot.values) && Array.isArray(snapshot.notes) && snapshot.notes.length === cellCount)) return null;

    return {
      ...progress,
      history: progress.history.slice(-50),
      showMistakes: progress.showMistakes !== false,
      completed: Boolean(progress.completed),
    };
  } catch {
    return null;
  }
}

export function saveCasualProgress(progress: CasualProgress) {
  try {
    return writeStoredValue(JSON.stringify(progress));
  } catch {
    return Promise.resolve();
  }
}
