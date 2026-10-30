import { useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BackLink, Card, Screen } from '@/components/screen';
import { palette, type Difficulty } from '@/constants/goodgrid';
import { loadCasualProgress, saveCasualProgress, type CasualProgress, type PuzzleData, type PuzzleSnapshot } from '@/lib/casual-progress';

const SYMBOLS = '123456789ABCDEFGHIJKLMNOP'.split('');
const CLUES: Record<Difficulty, Record<number, number>> = {
  easy: { 3: 40, 4: 190, 5: 500 },
  medium: { 3: 32, 4: 155, 5: 425 },
  hard: { 3: 26, 4: 125, 5: 350 },
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makePuzzle(boxSize: number, difficulty: Difficulty): PuzzleData {
  const side = boxSize * boxSize;
  const groups = shuffle(Array.from({ length: boxSize }, (_, i) => i));
  const rows = groups.flatMap(group => shuffle(Array.from({ length: boxSize }, (_, i) => group * boxSize + i)));
  const columnGroups = shuffle(Array.from({ length: boxSize }, (_, i) => i));
  const columns = columnGroups.flatMap(group => shuffle(Array.from({ length: boxSize }, (_, i) => group * boxSize + i)));
  const symbols = shuffle(Array.from({ length: side }, (_, i) => i));
  const solution = rows.flatMap(row => columns.map(column => symbols[(boxSize * (row % boxSize) + Math.floor(row / boxSize) + column) % side]));
  const clues = [...solution];
  const remove = side * side - CLUES[difficulty][boxSize];
  for (const cell of shuffle(Array.from({ length: side * side }, (_, i) => i)).slice(0, remove)) clues[cell] = -1;
  return { solution, clues };
}

export default function PuzzleScreen() {
  const params = useLocalSearchParams<{ mode?: string; size?: string; difficulty?: string }>();
  const boxSize = [3, 4, 5].includes(Number(params.size)) ? Number(params.size) : 3;
  const difficulty = (['easy', 'medium', 'hard'].includes(String(params.difficulty)) ? params.difficulty : 'easy') as Difficulty;
  const mode = params.mode === 'ranked' ? 'ranked' : 'casual';
  return <PuzzleGame key={`${mode}-${boxSize}-${difficulty}`} boxSize={boxSize} difficulty={difficulty} mode={mode} />;
}

function PuzzleGame({ boxSize, difficulty, mode }: { boxSize: number; difficulty: Difficulty; mode: 'casual' | 'ranked' }) {
  const [activeBoxSize, setActiveBoxSize] = useState(boxSize);
  const [activeDifficulty, setActiveDifficulty] = useState(difficulty);
  const [settingsBoxSize, setSettingsBoxSize] = useState(boxSize);
  const [settingsDifficulty, setSettingsDifficulty] = useState(difficulty);
  const [puzzle, setPuzzle] = useState(() => makePuzzle(boxSize, difficulty));
  const [values, setValues] = useState(puzzle.clues);
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: puzzle.clues.length }, () => []));
  const [history, setHistory] = useState<PuzzleSnapshot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [showMistakes, setShowMistakes] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(mode !== 'casual');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const progressRef = useRef<CasualProgress | null>(null);
  const isFocused = useIsFocused();
  const side = activeBoxSize * activeBoxSize;
  const { width } = useWindowDimensions();
  const { height } = useWindowDimensions();
  const compact = width < 620;
  const boardWidth = Math.max(Math.min(width - (compact ? 64 : 48), height - (compact ? 280 : 350), 760), 180);
  const symbols = SYMBOLS.slice(0, side);

  useEffect(() => {
    if (mode !== 'casual') return;

    let cancelled = false;
    void loadCasualProgress().then(progress => {
      if (cancelled) return;
      if (progress) {
        setActiveBoxSize(progress.boxSize as 3 | 4 | 5);
        setActiveDifficulty(progress.difficulty);
        setSettingsBoxSize(progress.boxSize);
        setSettingsDifficulty(progress.difficulty);
        setPuzzle(progress.puzzle);
        setValues(progress.values);
        setNotes(progress.notes);
        setHistory(progress.history);
        setSeconds(Math.floor(progress.seconds));
        setShowMistakes(progress.showMistakes);
        setCompleted(progress.completed);
        if (progress.completed) setMessage('Puzzle complete! A new puzzle is ready.');
      }
      setHydrated(true);
    }).catch(() => {
      if (!cancelled) setHydrated(true);
    });

    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const active = nextState === 'active';
      setAppActive(active);
      if (!active && mode === 'casual' && progressRef.current) {
        void saveCasualProgress(progressRef.current);
      }
    });
    return () => subscription.remove();
  }, [mode]);

  useEffect(() => {
    if (!hydrated || mode !== 'casual') return;
    const progress: CasualProgress = {
      version: 1,
      boxSize: activeBoxSize,
      difficulty: activeDifficulty,
      puzzle,
      values,
      notes,
      history,
      seconds,
      showMistakes,
      completed,
    };
    progressRef.current = progress;
    void saveCasualProgress(progress);
  }, [activeBoxSize, activeDifficulty, completed, history, hydrated, mode, notes, puzzle, seconds, showMistakes, values]);

  useFocusEffect(useCallback(() => () => {
    if (mode === 'casual' && progressRef.current) void saveCasualProgress(progressRef.current);
  }, [mode]));

  useEffect(() => {
    if (!isFocused || !appActive || !hydrated || completed) return;
    const timer = setInterval(() => setSeconds(current => current + 1), 1000);
    return () => clearInterval(timer);
  }, [appActive, completed, hydrated, isFocused]);

  useEffect(() => {
    if (mode !== 'casual' || !hydrated || !completed || !isFocused || !appActive) return;
    const timer = setTimeout(() => startPuzzle(activeBoxSize, activeDifficulty), 1800);
    return () => clearTimeout(timer);
  }, [activeBoxSize, activeDifficulty, appActive, completed, hydrated, isFocused, mode]);

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  function rememberCurrent() {
    const snapshot = { values: [...values], notes: notes.map(cellNotes => [...cellNotes]) };
    setHistory(current => [...current.slice(-49), snapshot]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setValues(previous.values);
    setNotes(previous.notes);
    setHistory(current => current.slice(0, -1));
    setMessage('');
    setCompleted(false);
  }

  function eraseSelected() {
    if (selected === null || puzzle.clues[selected] !== -1) return;
    if (values[selected] === -1 && notes[selected].length === 0) return;
    rememberCurrent();
    setValues(current => current.map((value, index) => index === selected ? -1 : value));
    setNotes(current => current.map((cellNotes, index) => index === selected ? [] : cellNotes));
    setMessage('');
    setCompleted(false);
  }

  function enter(value: number) {
    if (selected === null || puzzle.clues[selected] !== -1) return;
    if (noteMode) {
      if (values[selected] !== -1) return;
      rememberCurrent();
      setNotes(current => current.map((cellNotes, index) => {
        if (index !== selected) return cellNotes;
        return cellNotes.includes(value) ? cellNotes.filter(note => note !== value) : [...cellNotes, value].sort((a, b) => a - b);
      }));
      return;
    }

    rememberCurrent();
    const nextValues = [...values];
    nextValues[selected] = value;
    const boxRow = Math.floor(Math.floor(selected / side) / activeBoxSize);
    const boxColumn = Math.floor((selected % side) / activeBoxSize);
    const nextNotes = notes.map((cellNotes, index) => {
      if (index === selected) return [];
      const row = Math.floor(index / side);
      const column = index % side;
      const sharesBox = Math.floor(row / activeBoxSize) === boxRow && Math.floor(column / activeBoxSize) === boxColumn;
      return row === Math.floor(selected / side) || column === selected % side || sharesBox
        ? cellNotes.filter(note => note !== value)
        : cellNotes;
    });
    setValues(nextValues);
    setNotes(nextNotes);
    if (nextValues.every((cell, index) => cell === puzzle.solution[index])) {
      setMessage(mode === 'casual' ? 'Puzzle complete! A new puzzle is ready.' : 'Puzzle complete. Ranked score submission is not connected in this version yet.');
      if (mode === 'casual') {
        setCompleted(true);
      }
    }
  }

  function resetPuzzle() {
    startPuzzle(activeBoxSize, activeDifficulty);
  }

  function startPuzzle(nextBoxSize: number, nextDifficulty: Difficulty) {
    const nextPuzzle = makePuzzle(nextBoxSize, nextDifficulty);
    setActiveBoxSize(nextBoxSize as 3 | 4 | 5);
    setActiveDifficulty(nextDifficulty);
    setPuzzle(nextPuzzle);
    setValues(nextPuzzle.clues);
    setNotes(Array.from({ length: nextPuzzle.clues.length }, () => []));
    setHistory([]);
    setSelected(null);
    setSeconds(0);
    setMessage('');
    setCompleted(false);
    setNoteMode(false);
    setSettingsOpen(false);
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || mode !== 'casual') return;
    const flushOnPageHide = () => {
      if (progressRef.current) void saveCasualProgress(progressRef.current);
    };
    globalThis.addEventListener?.('pagehide', flushOnPageHide);
    return () => globalThis.removeEventListener?.('pagehide', flushOnPageHide);
  }, [mode]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && history.length > 0) {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === 'Backspace' && history.length > 0) {
        event.preventDefault();
        undo();
        return;
      }
      const index = symbols.indexOf(event.key.toUpperCase());
      if (index >= 0 && !event.metaKey && !event.ctrlKey && !event.altKey) enter(index);
    };
    globalThis.addEventListener?.('keydown', handleKeyDown);
    return () => globalThis.removeEventListener?.('keydown', handleKeyDown);
  });

  if (mode === 'casual' && !hydrated) {
    return <Screen><Card><Text style={styles.prompt}>Restoring your puzzle…</Text></Card></Screen>;
  }

  return (
    <Screen>
      {compact ? (
        <View style={[styles.toolbar, styles.toolbarCompact]}>
          <View style={styles.toolbarTop}>
            <BackLink href={mode === 'ranked' ? '/ranked' : '/'} label={mode === 'ranked' ? 'Ranked' : 'Home'} />
            <View style={styles.toolbarActions}>
              <Text style={styles.timer}>◷ {clock}</Text>
              {mode === 'casual' && <MenuButton onPress={() => { setSettingsBoxSize(activeBoxSize); setSettingsDifficulty(activeDifficulty); setSettingsOpen(true); }} />}
            </View>
          </View>
          <View style={styles.tags}><Text style={styles.tag}>{activeBoxSize}×{activeBoxSize} boxes</Text><Text style={styles.tag}>{capitalize(activeDifficulty)}</Text></View>
        </View>
      ) : (
        <View style={styles.toolbar}>
          <BackLink href={mode === 'ranked' ? '/ranked' : '/'} label={mode === 'ranked' ? 'Ranked' : 'Home'} />
          <View style={styles.tags}><Text style={styles.tag}>{activeBoxSize}×{activeBoxSize} boxes</Text><Text style={styles.tag}>{capitalize(activeDifficulty)}</Text></View>
          <View style={styles.toolbarActions}>
            <Text style={styles.timer}>◷ {clock}</Text>
            {mode === 'casual' && <MenuButton onPress={() => { setSettingsBoxSize(activeBoxSize); setSettingsDifficulty(activeDifficulty); setSettingsOpen(true); }} />}
          </View>
        </View>
      )}
      {mode === 'ranked' && <Text style={styles.preview}>Ranked preview · Daily verification and score submission are not connected yet.</Text>}
      <ScrollView style={styles.boardViewport} horizontal contentContainerStyle={styles.boardScroll} showsHorizontalScrollIndicator={side > 14}>
        <View style={[styles.board, { width: boardWidth, height: boardWidth }]}>
          {Array.from({ length: side }, (_, row) => (
            <View key={row} style={[styles.row, { height: `${100 / side}%` }]}>
              {Array.from({ length: side }, (_, column) => {
                const index = row * side + column;
                const value = values[index];
                const isSelected = selected === index;
                const sameValue = selected !== null && value !== -1 && values[selected] === value;
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`Row ${row + 1}, column ${column + 1}${value === -1 ? ', empty' : `, ${symbols[value]}`}`}
                    onPress={() => setSelected(index)}
                    style={[
                      styles.cell,
                      { width: `${100 / side}%`, borderRightWidth: column === side - 1 ? 0 : (column + 1) % activeBoxSize === 0 ? 2 : 1, borderBottomWidth: row === side - 1 ? 0 : (row + 1) % activeBoxSize === 0 ? 2 : 1 },
                      (isSelected || sameValue) && styles.cellHighlighted,
                      value !== -1 && puzzle.clues[index] === -1 && styles.entryCell,
                      showMistakes && value !== -1 && puzzle.clues[index] === -1 && value !== puzzle.solution[index] && styles.cellMistake,
                    ]}>
                    {value === -1 && notes[index].length > 0 ? (
                      <View style={styles.notesGrid}>
                        {notes[index].map(note => <Text key={note} style={[styles.noteText, { width: '20%', fontSize: Math.max(4, Math.min(8, boardWidth / side * 0.15)), color: palette.symbols[note % palette.symbols.length] }]}>{symbols[note]}</Text>)}
                      </View>
                    ) : (
                      <Text style={[styles.cellText, { fontSize: Math.max(7, Math.min(32, boardWidth / side * 0.5)), color: value === -1 ? palette.ink : palette.symbols[value % palette.symbols.length] }, isSelected && styles.selectedText, showMistakes && value !== -1 && puzzle.clues[index] === -1 && value !== puzzle.solution[index] && styles.mistakeText]}>{value === -1 ? '' : symbols[value]}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <Card style={[styles.controls, compact && styles.controlsCompact]}>
        <Text style={styles.prompt}>{selected === null ? 'Select a square, then choose a number' : 'Choose a number'}</Text>
        <View style={styles.gameActions}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: noteMode }} onPress={() => setNoteMode(current => !current)} style={[styles.actionButton, noteMode && styles.actionButtonActive]}>
            <Text style={[styles.actionButtonText, noteMode && styles.actionButtonTextActive]}>{noteMode ? '✓ Notes mode' : '✎ Notes mode'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo last move" accessibilityState={{ disabled: history.length === 0 }} disabled={history.length === 0} onPress={undo} style={[styles.actionButton, history.length === 0 && styles.actionButtonDisabled]}>
            <Text style={styles.actionButtonText}>↶ Undo</Text>
          </Pressable>
        </View>
        <View style={styles.numberPad}>
          {symbols.map((symbol, index) => (
            <Pressable key={symbol} accessibilityRole="button" onPress={() => enter(index)} style={[styles.numberButton, compact && styles.numberButtonCompact, { backgroundColor: `${palette.symbols[index % 9]}22`, borderColor: `${palette.symbols[index % 9]}44` }]}>
              <Text style={[styles.numberText, { color: palette.symbols[index % 9] }]}>{symbol}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={eraseSelected} style={[styles.numberButton, compact && styles.numberButtonCompact, styles.erase]}><Text style={styles.eraseText}>Erase</Text></Pressable>
        </View>
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        {mode === 'casual' && <Pressable onPress={resetPuzzle} style={styles.newPuzzle}><Text style={styles.newPuzzleText}>↻ New puzzle</Text></Pressable>}
      </Card>
      <Modal transparent visible={settingsOpen} animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close settings" style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.menuPanel, compact && styles.menuPanelCompact]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Puzzle settings</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={() => setSettingsOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <Text style={styles.menuLabel}>PUZZLE SIZE</Text>
            <View style={styles.menuOptions}>
              {([3, 4, 5] as const).map(size => <SettingOption key={size} title={`${size}×${size}`} selected={settingsBoxSize === size} onPress={() => setSettingsBoxSize(size)} />)}
            </View>
            <Text style={[styles.menuLabel, styles.menuLabelSpaced]}>DIFFICULTY</Text>
            <View style={styles.menuOptions}>
              {(['easy', 'medium', 'hard'] as const).map(level => <SettingOption key={level} title={capitalize(level)} selected={settingsDifficulty === level} onPress={() => setSettingsDifficulty(level)} />)}
            </View>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: showMistakes }} onPress={() => setShowMistakes(current => !current)} style={styles.mistakeSetting}>
              <View style={[styles.checkbox, showMistakes && styles.checkboxChecked]}><Text style={styles.checkboxMark}>{showMistakes ? '✓' : ''}</Text></View>
              <View><Text style={styles.mistakeSettingTitle}>Show mistakes</Text><Text style={styles.mistakeSettingCopy}>Highlight incorrect entries</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => startPuzzle(settingsBoxSize, settingsDifficulty)} style={styles.applyButton}>
              <Text style={styles.applyText}>Start new puzzle</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function MenuButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Open puzzle settings" onPress={onPress} style={styles.menuButton}><Text style={styles.menuButtonText}>☰</Text></Pressable>;
}

function SettingOption({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.settingOption, selected && styles.settingOptionSelected]}><Text style={[styles.settingOptionText, selected && styles.settingOptionTextSelected]}>{title}</Text></Pressable>;
}

function capitalize(value: string) { return value[0].toUpperCase() + value.slice(1); }

const styles = StyleSheet.create({
  toolbar: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  toolbarCompact: { alignItems: 'stretch', gap: 4 },
  toolbarTop: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { color: palette.sageDark, backgroundColor: '#eae8dd', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, overflow: 'hidden', fontWeight: '600', fontSize: 13 },
  timer: { color: palette.ink, fontVariant: ['tabular-nums'], fontSize: 17, fontWeight: '700' },
  preview: { color: '#9a704a', fontSize: 13, marginBottom: 10 },
  boardViewport: { width: '100%', minWidth: 0, flexGrow: 0 },
  boardScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  board: { overflow: 'hidden', borderWidth: 1.5, borderColor: '#aaa99a', borderRadius: 12, backgroundColor: palette.paper },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.paper, borderRightColor: '#d5d4c7', borderBottomColor: '#d5d4c7' },
  cellHighlighted: { backgroundColor: '#e5eadc' },
  entryCell: { backgroundColor: '#f8f6ef' },
  cellText: { color: palette.ink, fontWeight: '500' },
  selectedText: { fontWeight: '800' },
  mistakeText: { color: '#b34f43' },
  cellMistake: { backgroundColor: '#f8e5de' },
  notesGrid: { position: 'absolute', inset: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center' },
  noteText: { textAlign: 'center', lineHeight: 10 },
  controls: { width: '100%', minWidth: 0, marginTop: 12, padding: 20 },
  controlsCompact: { padding: 16 },
  prompt: { color: palette.ink, fontSize: 15, fontWeight: '600', marginBottom: 14 },
  gameActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  actionButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.paper },
  actionButtonActive: { borderColor: palette.sage, backgroundColor: palette.sageSoft },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonText: { color: palette.sageDark, fontSize: 13, fontWeight: '600' },
  actionButtonTextActive: { color: palette.sageDark },
  numberPad: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numberButton: { minWidth: 43, minHeight: 44, flexGrow: 1, flexBasis: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 11 },
  numberButtonCompact: { minWidth: 0, flexBasis: '16%' },
  numberText: { fontSize: 18, fontWeight: '600' },
  erase: { backgroundColor: '#f3f1e9', borderColor: palette.border },
  eraseText: { color: palette.sageDark, fontWeight: '600' },
  message: { marginTop: 14, color: palette.sageDark, fontWeight: '700' },
  newPuzzle: { alignSelf: 'flex-start', marginTop: 15, paddingVertical: 8, paddingHorizontal: 12 },
  newPuzzleText: { color: palette.sageDark, fontWeight: '700' },
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.paper },
  menuButtonText: { color: palette.sageDark, fontSize: 18, fontWeight: '700' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(25, 28, 24, 0.42)' },
  menuPanel: { width: '100%', maxWidth: 520, padding: 24, borderRadius: 22, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, elevation: 8 },
  menuPanelCompact: { padding: 20 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  menuTitle: { color: palette.ink, fontSize: 21, fontWeight: '700' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.panel },
  closeText: { color: palette.sageDark, fontSize: 26, lineHeight: 30 },
  menuLabel: { color: palette.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  menuLabelSpaced: { marginTop: 20 },
  menuOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  settingOption: { flexGrow: 1, flexBasis: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.paper },
  settingOptionSelected: { backgroundColor: palette.sageSoft, borderColor: palette.sage },
  settingOptionText: { color: palette.muted, fontWeight: '600' },
  settingOptionTextSelected: { color: palette.sageDark },
  mistakeSetting: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 22, paddingVertical: 4 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.paper },
  checkboxChecked: { borderColor: palette.sageDark, backgroundColor: palette.sageDark },
  checkboxMark: { color: palette.paper, fontSize: 14, fontWeight: '700' },
  mistakeSettingTitle: { color: palette.ink, fontWeight: '600' },
  mistakeSettingCopy: { color: palette.muted, fontSize: 12, marginTop: 2 },
  applyButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24, borderRadius: 13, backgroundColor: palette.sageDark },
  applyText: { color: palette.paper, fontWeight: '700', fontSize: 16 },
});
