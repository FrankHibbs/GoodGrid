"use strict";

const SYMBOLS = "123456789ABCDEFGHIJKLMNOP";
const COLORS = ["", "cell-symbol-1", "cell-symbol-2", "cell-symbol-3", "cell-symbol-4", "cell-symbol-5", "cell-symbol-6", "cell-symbol-7", "cell-symbol-8", "cell-symbol-9"];
const CLUES = {
  easy: { 3: 40, 4: 190, 5: 500 },
  medium: { 3: 32, 4: 155, 5: 425 },
  hard: { 3: 26, 4: 125, 5: 350 }
};
const APP_STATE_KEY = "goodgrid-app-state-v1";
const CASUAL_STATE_KEY = "goodgrid-casual-state-v1";

const boardElement = document.querySelector("#board");
const sizeSelect = document.querySelector("#size-select");
const difficultyButtons = [...document.querySelectorAll(".difficulty-option")];
const timerElement = document.querySelector("#timer");
const numberPad = document.querySelector("#number-pad");
const messageElement = document.querySelector("#message");
const undoButton = document.querySelector("#undo-button");
const mistakesToggle = document.querySelector("#mistakes-toggle");
const notesToggle = document.querySelector("#notes-toggle");
const sizeTag = document.querySelector("#size-tag");
const difficultyTag = document.querySelector("#difficulty-tag");
const screens = [...document.querySelectorAll(".app-screen")];
const supabaseClient = window.goodGridSupabase;
const homeScreen = document.querySelector("#home-screen");
const rankedStatus = document.querySelector("#ranked-status");
const authStatus = document.querySelector("#auth-status");
const leaderboardRows = document.querySelector("#leaderboard-rows");

let boxSize = 3;
let difficulty = "easy";
let side = boxSize * boxSize;
let solution = [];
let puzzle = [];
let values = [];
let notes = [];
let cells = [];
let selected = -1;
let history = [];
let startedAt = Date.now();
let casualElapsedMs = 0;
let timerInterval;
let completed = false;
let playMode = "casual";
let casualCompletionTimeout = null;
let authSession = null;
let authMode = "login";
let pendingRankedSize = null;
try { pendingRankedSize = Number(sessionStorage.getItem("goodgrid-pending-ranked-size")) || null; }
catch { /* Ranked navigation can still work when browser storage is disabled. */ }
let rankedAttemptId = null;
let rankedDate = null;
let rankedWrongCells = new Set();
let rankedSubmissionPending = false;
let rankedResultMs = null;
let rankedElapsedMs = 0;
let rankedResumedAt = null;
let rankedPausePending = false;
let previousMistakesSetting = true;
let casualCloudSaveTimer = null;
let casualCloudSaveInFlight = Promise.resolve();
let casualCloudSyncUserId = null;
let casualCloudSyncPromise = null;

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function shuffledIndexes(n) {
  const groups = shuffle(Array.from({ length: n }, (_, i) => i));
  return groups.flatMap(group => shuffle(Array.from({ length: boxSize }, (_, i) => group * boxSize + i)));
}

function generateSolution() {
  const rows = shuffledIndexes(boxSize);
  const columns = shuffledIndexes(boxSize);
  const symbols = shuffle(Array.from({ length: side }, (_, i) => i));
  return rows.map(row => columns.map(column => symbols[(boxSize * (row % boxSize) + Math.floor(row / boxSize) + column) % side]));
}

function buildPuzzle() {
  solution = generateSolution();
  puzzle = solution.map(row => row.slice());
  const keep = CLUES[difficulty][boxSize];
  const positions = shuffle(Array.from({ length: side * side }, (_, i) => i));
  for (const position of positions.slice(keep)) puzzle[Math.floor(position / side)][position % side] = -1;
  values = puzzle.flat();
  notes = Array.from({ length: side * side }, () => new Set());
}

function symbolFor(value) {
  return SYMBOLS[value] || "";
}

function symbolColor(value) {
  return COLORS[(value % 9) + 1];
}

function renderBoard() {
  boardElement.replaceChildren();
  boardElement.style.setProperty("--size", side);
  boardElement.style.setProperty("--box", boxSize);
  boardElement.dataset.size = String(side);
  cells = [];
  for (let index = 0; index < side * side; index += 1) {
    const row = Math.floor(index / side);
    const column = index % side;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.style.setProperty("--note-cols", boxSize);
    cell.setAttribute("role", "gridcell");
    cell.dataset.index = String(index);
    cell.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}, ${values[index] === -1 ? "empty" : `value ${symbolFor(values[index])}${puzzle[row][column] !== -1 ? ", given" : ""}`}`);
    if (column < side - 1 && (column + 1) % boxSize === 0) cell.classList.add("box-right");
    if (row < side - 1 && (row + 1) % boxSize === 0) cell.classList.add("box-bottom");
    if (puzzle[row][column] !== -1) cell.classList.add("given");
    cell.addEventListener("click", () => selectCell(index));
    boardElement.append(cell);
    cells.push(cell);
  }
  renderNumberPad();
  renderCells();
}

function renderNumberPad() {
  numberPad.replaceChildren();
  for (let value = 0; value < side; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pad-key key-${(value % 9) + 1}`;
    button.textContent = symbolFor(value);
    button.setAttribute("aria-label", `Enter ${symbolFor(value)}`);
    button.addEventListener("click", () => enterValue(value));
    numberPad.append(button);
  }
}

function selectCell(index) {
  selected = index;
  messageElement.textContent = "";
  messageElement.classList.remove("success");
  renderCells();
  if (playMode === "casual") persistAppState();
}

function isWrong(index) {
  if (playMode === "ranked") return rankedWrongCells.has(index);
  const value = values[index];
  if (value === -1 || puzzle[Math.floor(index / side)][index % side] !== -1) return false;
  return value !== solution[Math.floor(index / side)][index % side];
}

function renderCells() {
  const selectedValue = selected >= 0 ? values[selected] : -1;
  const { counts, complete } = symbolStatus();
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const row = Math.floor(index / side);
    const column = index % side;
    const value = values[index];
    cell.classList.toggle("selected", index === selected);
    cell.classList.toggle("related", selected >= 0 && index !== selected && (row === Math.floor(selected / side) || column === selected % side || (Math.floor(row / boxSize) === Math.floor(selected / side / boxSize) && Math.floor(column / boxSize) === Math.floor(selected % side / boxSize))));
    cell.classList.toggle("same-value", selectedValue !== -1 && value === selectedValue && index !== selected);
    cell.classList.toggle("mistake", mistakesToggle.checked && isWrong(index));
    cell.classList.toggle("completed-value", value !== -1 && complete[value]);
    cell.classList.toggle("notes", value === -1 && notes[index].size > 0);
    cell.classList.remove(...COLORS.slice(1));
    cell.replaceChildren();
    if (value !== -1) {
      cell.textContent = symbolFor(value);
      cell.classList.add(symbolColor(value));
      const label = `Row ${row + 1}, column ${column + 1}, ${symbolFor(value)}${puzzle[row][column] !== -1 ? ", given" : ", your entry"}${isWrong(index) ? ", incorrect" : ""}`;
      cell.setAttribute("aria-label", label);
    } else {
      cell.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}, ${notes[index].size ? `notes ${[...notes[index]].sort((a, b) => a - b).map(symbolFor).join(" ")}` : "empty"}`);
      if (notes[index].size) {
        const noteGrid = document.createElement("span");
        noteGrid.className = "cell-notes";
        noteGrid.style.gridTemplateColumns = `repeat(${boxSize}, 1fr)`;
        noteGrid.style.gridTemplateRows = `repeat(${boxSize}, 1fr)`;
        for (let n = 0; n < side; n += 1) {
          const note = document.createElement("span");
          note.textContent = notes[index].has(n) ? symbolFor(n) : "";
          noteGrid.append(note);
        }
        cell.append(noteGrid);
      }
    }
  }
  renderSymbolPad(complete);
}

function symbolStatus() {
  const counts = Array(side).fill(0);
  const rowCounts = Array.from({ length: side }, () => Array(side).fill(0));
  const columnCounts = Array.from({ length: side }, () => Array(side).fill(0));
  const boxCounts = Array.from({ length: side }, () => Array(side).fill(0));
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === -1) continue;
    const row = Math.floor(index / side);
    const column = index % side;
    const box = Math.floor(row / boxSize) * boxSize + Math.floor(column / boxSize);
    counts[value] += 1;
    rowCounts[row][value] += 1;
    columnCounts[column][value] += 1;
    boxCounts[box][value] += 1;
  }
  const complete = Array.from({ length: side }, (_, value) => {
    if (counts[value] !== side) return false;
    return rowCounts.every(row => row[value] === 1)
      && columnCounts.every(column => column[value] === 1)
      && boxCounts.every(box => box[value] === 1);
  });
  return { counts, complete };
}

function renderSymbolPad(complete) {
  for (let value = 0; value < side; value += 1) {
    const padKey = numberPad.children[value];
    if (padKey) padKey.classList.toggle("completed-value", complete[value]);
  }
}

function saveHistory(index) {
  history.push({ index, value: values[index], notes: [...notes[index]] });
  undoButton.disabled = false;
}

function enterValue(value) {
  if (selected < 0 || completed || rankedSubmissionPending || rankedPausePending || puzzle[Math.floor(selected / side)][selected % side] !== -1) return;
  saveHistory(selected);
  rankedWrongCells.delete(selected);
  if (notesToggle.checked) {
    if (notes[selected].has(value)) notes[selected].delete(value);
    else notes[selected].add(value);
  } else {
    values[selected] = value;
    notes[selected].clear();
  }
  renderCells();
  scheduleRankedProgressSave();
  if (playMode === "casual") persistAppState();
  checkCompletion();
}

function eraseSelected() {
  if (selected < 0 || completed || rankedSubmissionPending || rankedPausePending || puzzle[Math.floor(selected / side)][selected % side] !== -1) return;
  if (values[selected] === -1 && notes[selected].size === 0) return;
  saveHistory(selected);
  values[selected] = -1;
  notes[selected].clear();
  rankedWrongCells.delete(selected);
  renderCells();
  scheduleRankedProgressSave();
  if (playMode === "casual") persistAppState();
}

function undo() {
  if (rankedPausePending || rankedSubmissionPending) return;
  const previous = history.pop();
  if (!previous) return;
  values[previous.index] = previous.value;
  notes[previous.index] = new Set(previous.notes);
  selected = previous.index;
  undoButton.disabled = history.length === 0;
  renderCells();
  scheduleRankedProgressSave();
  if (playMode === "casual") persistAppState();
  checkCompletion();
}

function checkCompletion() {
  if (playMode === "ranked") {
    if (values.every(value => value !== -1)) submitRankedBoard();
    return;
  }
  const done = values.every((value, index) => value === solution[Math.floor(index / side)][index % side]);
  if (done) {
    completed = true;
    clearInterval(timerInterval);
    timerInterval = null;
    casualElapsedMs = Math.max(0, Date.now() - startedAt);
    messageElement.textContent = "Congratulations! You completed the puzzle.";
    messageElement.classList.add("success");
    persistAppState();
    clearTimeout(casualCompletionTimeout);
    casualCompletionTimeout = setTimeout(() => {
      casualCompletionTimeout = null;
      newPuzzle();
    }, 2000);
  } else if (completed) {
    completed = false;
    clearTimeout(casualCompletionTimeout);
    casualCompletionTimeout = null;
    startTimer();
    messageElement.textContent = "";
    messageElement.classList.remove("success");
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  startTimerAt(Date.now());
}

function startTimerAt(timestamp) {
  clearInterval(timerInterval);
  startedAt = timestamp;
  casualElapsedMs = Math.max(0, Date.now() - startedAt);
  timerElement.textContent = formatTime(Math.floor(casualElapsedMs / 1000));
  timerInterval = setInterval(() => {
    if (rankedResultMs !== null) return;
    casualElapsedMs = Math.max(0, Date.now() - startedAt);
    timerElement.textContent = formatTime(Math.floor(casualElapsedMs / 1000));
    if (playMode === "casual") {
      const elapsedSeconds = Math.floor(casualElapsedMs / 1000);
      persistAppState(undefined, { syncCloud: elapsedSeconds % 15 === 0 });
    }
  }, 1000);
}

function pauseCasualTimer() {
  if (timerInterval) casualElapsedMs = Math.max(0, Date.now() - startedAt);
  clearInterval(timerInterval);
  timerInterval = null;
  timerElement.textContent = formatTime(Math.floor(casualElapsedMs / 1000));
}

function startRankedTimer(elapsedMs, resumedAt) {
  clearInterval(timerInterval);
  rankedElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  rankedResumedAt = Date.parse(resumedAt) || Date.now();
  const update = () => {
    const currentElapsed = rankedElapsedMs + Math.max(0, Date.now() - rankedResumedAt);
    timerElement.textContent = formatTime(Math.floor(currentElapsed / 1000));
  };
  update();
  timerInterval = setInterval(update, 250);
}

function newPuzzle() {
  clearTimeout(casualCompletionTimeout);
  casualCompletionTimeout = null;
  playMode = "casual";
  rankedAttemptId = null;
  rankedDate = null;
  rankedWrongCells = new Set();
  rankedSubmissionPending = false;
  rankedResultMs = null;
  rankedElapsedMs = 0;
  rankedResumedAt = null;
  rankedPausePending = false;
  setRankedControls(false);
  boxSize = Number(sizeSelect.value);
  side = boxSize * boxSize;
  buildPuzzle();
  selected = -1;
  history = [];
  completed = false;
  undoButton.disabled = true;
  sizeTag.textContent = `${boxSize}x${boxSize} boxes`;
  difficultyTag.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
  messageElement.textContent = "";
  messageElement.classList.remove("success");
  renderBoard();
  startTimer();
  persistAppState();
}

function keyboardValue(key) {
  const symbol = key.toUpperCase();
  const value = SYMBOLS.indexOf(symbol);
  return value >= 0 && value < side ? value : -1;
}

function showScreen(id) {
  const currentScreen = screens.find(screen => !screen.hidden);
  if (currentScreen?.id === "game-screen" && id !== "game-screen" && playMode === "casual") {
    pauseCasualTimer();
  }
  screens.forEach(screen => { screen.hidden = screen.id !== id; });
  persistAppState(id);
}

function scopedStorageKey(key) {
  const userId = authSession?.user?.id;
  return userId ? `${key}:${userId}` : key;
}

function persistAppState(screenId, { syncCloud = true } = {}) {
  const activeScreen = screenId || screens.find(screen => !screen.hidden)?.id || "home-screen";
  const state = {
    screenId: activeScreen,
    playMode,
    boxSize,
    difficulty,
    authMode,
    savedAt: Date.now()
  };
  if (playMode === "casual" && puzzle.length === side && solution.length === side && values.length === side * side) {
    state.puzzle = puzzle.map(row => row.slice());
    state.solution = solution.map(row => row.slice());
    state.values = values.slice();
    state.notes = notes.map(cellNotes => [...cellNotes]);
    state.selected = selected;
    state.elapsedMs = timerInterval ? Math.max(0, Date.now() - startedAt) : casualElapsedMs;
    state.showMistakes = mistakesToggle.checked;
    state.notesMode = notesToggle.checked;
    state.savedAt = Date.now();
  }
  if (playMode === "ranked") state.rankedSize = boxSize;
  try {
    localStorage.setItem(scopedStorageKey(APP_STATE_KEY), JSON.stringify(state));
  }
  catch { /* Saving still works for this session when browser storage is unavailable. */ }
  if (state.playMode === "casual" && state.puzzle) {
    try { localStorage.setItem(scopedStorageKey(CASUAL_STATE_KEY), JSON.stringify(state)); }
    catch { /* The cloud copy can still be saved when local storage is unavailable. */ }
    if (syncCloud && authSession?.user?.id && supabaseClient) queueCasualCloudSave(state);
  }
}

function readAppState() {
  try { return JSON.parse(localStorage.getItem(scopedStorageKey(APP_STATE_KEY)) || "null"); }
  catch { return null; }
}

function readCasualState() {
  try {
    const stored = localStorage.getItem(scopedStorageKey(CASUAL_STATE_KEY));
    if (stored) return JSON.parse(stored);
    const appState = readAppState();
    return appState?.playMode === "casual" && appState.puzzle ? appState : null;
  } catch { return null; }
}

function queueCasualCloudSave(state) {
  const userId = authSession?.user?.id;
  if (!userId) return;
  clearTimeout(casualCloudSaveTimer);
  casualCloudSaveTimer = setTimeout(() => {
    casualCloudSaveInFlight = casualCloudSaveInFlight
      .catch(() => {})
      .then(() => writeCasualCloudSave(state, userId));
  }, 700);
}

async function writeCasualCloudSave(state, userId = authSession?.user?.id) {
  if (!userId || authSession?.user?.id !== userId || !supabaseClient || !state?.puzzle) return;
  const { error } = await supabaseClient.from("casual_saves").upsert({
    user_id: userId,
    save_data: state
  }, { onConflict: "user_id" });
  if (error) console.warn("Could not sync casual puzzle progress.", error.message);
}

function syncCasualCloudSave(session, guestSave) {
  if (!session?.user?.id || !supabaseClient) return Promise.resolve();
  const userId = session.user.id;
  if (casualCloudSyncUserId === userId && casualCloudSyncPromise) return casualCloudSyncPromise;
  casualCloudSyncUserId = userId;
  casualCloudSyncPromise = loadAndSyncCasualCloudSave(session, guestSave).catch(error => {
    console.warn("Could not sync casual puzzle progress.", error);
  });
  return casualCloudSyncPromise;
}

async function loadAndSyncCasualCloudSave(session, guestSave) {
  const userId = session.user.id;
  const { data, error } = await supabaseClient.from("casual_saves")
    .select("save_data,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Could not load casual puzzle progress from Supabase.", error.message);
    return;
  }
  if (authSession?.user?.id !== userId) return;

  const localSave = readCasualState();
  const remoteSave = data?.save_data;
  const localSavedAt = Number(localSave?.savedAt) || 0;
  const remoteSavedAt = Date.parse(data?.updated_at) || Number(remoteSave?.savedAt) || 0;
  let selectedSave;
  if (remoteSave && localSave && localSavedAt > remoteSavedAt) selectedSave = localSave;
  else if (remoteSave) selectedSave = { ...remoteSave, savedAt: remoteSavedAt || Number(remoteSave.savedAt) || 0 };
  else selectedSave = localSave || guestSave || null;
  if (!selectedSave?.puzzle) return;

  try { localStorage.setItem(scopedStorageKey(CASUAL_STATE_KEY), JSON.stringify(selectedSave)); }
  catch { /* Keep the in-memory and server copies when local storage is unavailable. */ }
  if (!remoteSave || selectedSave === localSave || selectedSave === guestSave) {
    await writeCasualCloudSave(selectedSave, userId);
  }

  const appState = readAppState();
  if (!appState || remoteSavedAt > (Number(appState.savedAt) || 0)) {
    try { localStorage.setItem(scopedStorageKey(APP_STATE_KEY), JSON.stringify(selectedSave)); }
    catch { /* The casual save remains available through its dedicated local key. */ }
  }
}

function restoreCasualPuzzle(state) {
  const targetBoxSize = Number(state?.boxSize);
  const targetSide = targetBoxSize * targetBoxSize;
  const isValid = [3, 4, 5].includes(targetBoxSize)
    && Array.isArray(state.puzzle) && state.puzzle.length === targetSide
    && state.puzzle.every(row => Array.isArray(row) && row.length === targetSide)
    && Array.isArray(state.solution) && state.solution.length === targetSide
    && state.solution.every(row => Array.isArray(row) && row.length === targetSide)
    && Array.isArray(state.values) && state.values.length === targetSide * targetSide;
  if (!isValid) return false;

  playMode = "casual";
  rankedAttemptId = null;
  savedCasualSettings = null;
  setRankedControls(false);
  boxSize = targetBoxSize;
  side = targetSide;
  difficulty = ["easy", "medium", "hard"].includes(state.difficulty) ? state.difficulty : "easy";
  sizeSelect.value = String(boxSize);
  difficultyButtons.forEach(button => {
    const active = button.dataset.difficulty === difficulty;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  previousMistakesSetting = state.showMistakes !== false;
  mistakesToggle.checked = previousMistakesSetting;
  notesToggle.checked = state.notesMode === true;
  puzzle = state.puzzle.map(row => row.slice());
  solution = state.solution.map(row => row.slice());
  values = state.values.map(value => Number.isInteger(value) && value >= -1 && value < side ? value : -1);
  notes = Array.from({ length: side * side }, (_, index) => new Set(
    Array.isArray(state.notes?.[index]) ? state.notes[index].filter(value => Number.isInteger(value) && value >= 0 && value < side) : []
  ));
  selected = Number.isInteger(state.selected) && state.selected >= 0 && state.selected < side * side ? state.selected : -1;
  history = [];
  completed = values.every((value, index) => value === solution[Math.floor(index / side)][index % side]);
  casualElapsedMs = Math.max(0, Number(state.elapsedMs) || 0);
  undoButton.disabled = true;
  sizeTag.textContent = `${boxSize}x${boxSize} boxes`;
  difficultyTag.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
  messageElement.textContent = completed ? "Congratulations! You completed the puzzle." : "Your casual puzzle has been restored.";
  messageElement.classList.toggle("success", completed);
  renderBoard();
  showScreen("game-screen");
  if (completed) {
    clearInterval(timerInterval);
    timerInterval = null;
    timerElement.textContent = formatTime(Math.floor(casualElapsedMs / 1000));
    clearTimeout(casualCompletionTimeout);
    casualCompletionTimeout = setTimeout(() => {
      casualCompletionTimeout = null;
      newPuzzle();
    }, 2000);
  } else {
    startTimerAt(Date.now() - casualElapsedMs);
  }
  return true;
}

async function restoreAppPage() {
  const state = readAppState();
  if (!state) return;
  if (rankedAttemptId || pendingRankedSize) return;
  if (state.playMode === "casual" && state.screenId === "game-screen" && restoreCasualPuzzle(readCasualState() || state)) return;
  if (state.playMode === "ranked" && state.screenId === "game-screen" && [3, 4, 5].includes(Number(state.rankedSize))) {
    await startRankedAttempt(Number(state.rankedSize));
    return;
  }
  playMode = state.playMode === "ranked" ? "ranked" : "casual";
  boxSize = Number(state.rankedSize || state.boxSize) || 3;
  side = boxSize * boxSize;
  if (["easy", "medium", "hard"].includes(state.difficulty)) difficulty = state.difficulty;
  sizeSelect.value = String(boxSize);
  difficultyButtons.forEach(button => {
    const active = button.dataset.difficulty === difficulty;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (state.screenId === "auth-screen" && ["login", "signup", "recovery"].includes(state.authMode)) setAuthMode(state.authMode);
  if (state.screenId && screens.some(screen => screen.id === state.screenId)) showScreen(state.screenId);
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function updateAccountStatus() {
  const label = document.querySelector("#ranked-account-label");
  const action = document.querySelector("#account-action");
  const username = authSession?.user?.user_metadata?.username;
  label.textContent = authSession ? `Signed in as ${username || authSession.user.email}` : "Sign in to save ranked results.";
  action.textContent = authSession ? "Sign out" : "Sign in";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";
  document.querySelector(".auth-tabs").hidden = isRecovery;
  document.querySelector("#username-field").hidden = !isSignup;
  document.querySelector("#auth-username").required = isSignup;
  document.querySelector("#auth-email").parentElement.hidden = isRecovery;
  document.querySelector("#auth-email").required = !isRecovery;
  document.querySelector("#auth-password").autocomplete = isSignup || isRecovery ? "new-password" : "current-password";
  document.querySelector("#auth-password").required = true;
  document.querySelector("#auth-submit").textContent = isSignup ? "Create account" : isRecovery ? "Save new password" : "Sign in";
  document.querySelector("#reset-password").hidden = isSignup || isRecovery;
  document.querySelector("#login-tab").classList.toggle("selected", !isSignup && !isRecovery);
  document.querySelector("#signup-tab").classList.toggle("selected", isSignup);
  document.querySelector("#login-tab").setAttribute("aria-selected", String(!isSignup && !isRecovery));
  document.querySelector("#signup-tab").setAttribute("aria-selected", String(isSignup));
  document.querySelector("#auth-heading").textContent = isSignup ? "Create your account" : isRecovery ? "Choose a new password" : "Sign in to your account";
  setStatus(authStatus, "");
}

let savedCasualSettings = null;
function setRankedControls(isRanked) {
  if (isRanked && !savedCasualSettings) {
    savedCasualSettings = {
      boxSize: Number(sizeSelect.value),
      difficulty,
      showMistakes: mistakesToggle.checked
    };
  }
  if (!isRanked && savedCasualSettings) {
    sizeSelect.value = String(savedCasualSettings.boxSize);
    difficulty = savedCasualSettings.difficulty;
    previousMistakesSetting = savedCasualSettings.showMistakes;
    difficultyButtons.forEach(button => {
      const active = button.dataset.difficulty === difficulty;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    savedCasualSettings = null;
  }
  sizeSelect.disabled = isRanked;
  difficultyButtons.forEach(button => { button.disabled = isRanked; });
  mistakesToggle.disabled = isRanked;
  if (isRanked) mistakesToggle.checked = true;
  else mistakesToggle.checked = previousMistakesSetting;
  document.querySelector("#new-puzzle").hidden = isRanked;
}

function openAuthForChallenge(size) {
  pendingRankedSize = size;
  try { sessionStorage.setItem("goodgrid-pending-ranked-size", String(size)); }
  catch { /* The in-memory selection remains available for this session. */ }
  setAuthMode("login");
  setStatus(authStatus, "Sign in or create an account to start this ranked challenge.");
  showScreen("auth-screen");
}

function showSupabaseSetupMessage() {
  setStatus(rankedStatus, "Ranked mode needs a Supabase project. Casual puzzles work now; see SUPABASE_SETUP.md to connect accounts and rankings.", true);
}

async function startRankedAttempt(size) {
  if (!window.goodGridSupabaseConfigured || !supabaseClient) {
    showScreen("ranked-screen");
    showSupabaseSetupMessage();
    return;
  }
  if (!authSession) {
    openAuthForChallenge(size);
    return;
  }

  showScreen("ranked-screen");
  setStatus(rankedStatus, "Loading today’s shared puzzle…");
  document.querySelectorAll("[data-ranked-size]").forEach(button => { button.disabled = true; });
  const { data, error } = await supabaseClient.functions.invoke("ranked-start", { body: { boxSize: size } });
  document.querySelectorAll("[data-ranked-size]").forEach(button => { button.disabled = false; });
  if (error || data?.error) {
    setStatus(rankedStatus, data?.error || error.message || "Could not start the ranked challenge.", true);
    return;
  }
  startRankedGame(data);
}

function startRankedGame(challenge) {
  if (!savedCasualSettings) {
    savedCasualSettings = {
      boxSize: Number(sizeSelect.value),
      difficulty,
      showMistakes: mistakesToggle.checked
    };
  }
  playMode = "ranked";
  rankedAttemptId = challenge.attemptId;
  rankedDate = challenge.date;
  rankedWrongCells = new Set();
  rankedSubmissionPending = false;
  rankedPausePending = false;
  rankedResultMs = null;
  boxSize = Number(challenge.boxSize);
  side = boxSize * boxSize;
  difficulty = "medium";
  sizeSelect.value = String(boxSize);
  difficultyButtons.forEach(button => {
    const active = button.dataset.difficulty === difficulty;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setRankedControls(true);
  puzzle = challenge.puzzle;
  solution = [];
  let savedProgress = challenge.progress || {};
  try {
    const localProgress = JSON.parse(localStorage.getItem(`goodgrid-progress-${challenge.attemptId}`) || "null");
    if (localProgress?.updatedAt > (savedProgress.updatedAt || 0)) savedProgress = localProgress;
  } catch { /* Continue from the server copy when local storage is unavailable. */ }
  values = Array.isArray(savedProgress.values) && savedProgress.values.length === side * side
    ? savedProgress.values.slice()
    : puzzle.flat();
  notes = Array.from({ length: side * side }, (_, index) => new Set(savedProgress.notes?.[index] || []));
  selected = -1;
  history = [];
  completed = false;
  undoButton.disabled = true;
  sizeTag.textContent = `${boxSize}x${boxSize} boxes`;
  difficultyTag.textContent = "Medium · Ranked";
  messageElement.textContent = challenge.resumed ? "Your ranked attempt is ready to resume." : "Ranked time starts when this challenge was issued.";
  messageElement.classList.remove("success");
  renderBoard();
  showScreen("game-screen");
  startRankedTimer(challenge.elapsedMs, challenge.resumedAt || challenge.startedAt);
  setStatus(rankedStatus, "");
}

let progressSaveTimer;
async function leaveRankedGame(nextScreen) {
  if (playMode !== "ranked" || !rankedAttemptId || completed) {
    clearInterval(timerInterval);
    showScreen(nextScreen);
    return;
  }
  if (rankedPausePending) return;
  if (rankedSubmissionPending) {
    messageElement.textContent = "Please wait while your result is being verified.";
    return;
  }

  rankedPausePending = true;
  messageElement.textContent = "Saving progress and pausing your ranked puzzle…";
  clearTimeout(progressSaveTimer);
  const attemptId = rankedAttemptId;
  const snapshot = {
    values: [...values],
    notes: notes.map(cellNotes => [...cellNotes]),
    updatedAt: Date.now()
  };
  try { localStorage.setItem(`goodgrid-progress-${attemptId}`, JSON.stringify(snapshot)); }
  catch { /* The server copy remains available if local storage is unavailable. */ }

  try {
    await supabaseClient.functions.invoke("ranked-progress", {
      body: { attemptId, ...snapshot }
    });
    const { data, error } = await supabaseClient.functions.invoke("ranked-pause", {
      body: { attemptId }
    });
    if (error || data?.error) {
      messageElement.textContent = data?.error || error.message || "Could not pause this ranked puzzle. Please try again.";
      return;
    }

    rankedElapsedMs = Math.max(0, Number(data.elapsedMs) || 0);
    rankedResumedAt = null;
    clearInterval(timerInterval);
    timerElement.textContent = formatTime(Math.floor(rankedElapsedMs / 1000));
    showScreen(nextScreen);
  } catch (error) {
    messageElement.textContent = error instanceof Error ? error.message : "Could not pause this ranked puzzle. Please try again.";
  } finally {
    rankedPausePending = false;
  }
}

function scheduleRankedProgressSave() {
  if (playMode !== "ranked" || !rankedAttemptId || completed) return;
  clearTimeout(progressSaveTimer);
  const snapshot = {
    values: [...values],
    notes: notes.map(cellNotes => [...cellNotes]),
    updatedAt: Date.now()
  };
  try { localStorage.setItem(`goodgrid-progress-${rankedAttemptId}`, JSON.stringify(snapshot)); }
  catch { /* The server copy still provides cross-session recovery. */ }
  progressSaveTimer = setTimeout(async () => {
    const { error } = await supabaseClient.functions.invoke("ranked-progress", {
      body: {
        attemptId: rankedAttemptId,
        values: snapshot.values,
        notes: snapshot.notes,
        updatedAt: snapshot.updatedAt
      }
    });
    if (error) messageElement.textContent = "Progress could not sync yet. Keep this tab open while reconnecting.";
  }, 350);
}

async function submitRankedBoard() {
  if (rankedSubmissionPending || completed || !rankedAttemptId) return;
  clearTimeout(progressSaveTimer);
  rankedSubmissionPending = true;
  messageElement.textContent = "Verifying your board…";
  const { data, error } = await supabaseClient.functions.invoke("ranked-submit", {
    body: { attemptId: rankedAttemptId, values }
  });
  rankedSubmissionPending = false;
  if (error || data?.error) {
    messageElement.replaceChildren();
    messageElement.append(document.createTextNode(data?.error || "Could not verify the board. Check your connection and retry. "));
    if (!data?.error) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-button";
      retry.textContent = "Retry";
      retry.addEventListener("click", submitRankedBoard);
      messageElement.append(retry);
    }
    return;
  }
  if (!data.valid) {
    rankedWrongCells = new Set(data.invalidIndices || []);
    messageElement.textContent = "Some symbols are incorrect. Correct the highlighted squares to submit.";
    renderCells();
    return;
  }
  completed = true;
  rankedResultMs = Number(data.elapsedMs);
  rankedElapsedMs = rankedResultMs;
  rankedResumedAt = null;
  try { localStorage.removeItem(`goodgrid-progress-${rankedAttemptId}`); }
  catch { /* Ignored when storage is unavailable. */ }
  clearInterval(timerInterval);
  timerElement.textContent = formatTime(Math.floor(rankedResultMs / 1000));
  messageElement.textContent = `Verified! Your time: ${formatRankTime(rankedResultMs)}. Your score is on today’s leaderboard.`;
  messageElement.classList.add("success");
}

function formatRankTime(milliseconds) {
  const totalMs = Math.max(0, milliseconds);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const fraction = totalMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(3, "0")}`;
}

async function loadLeaderboard() {
  const box = Number(document.querySelector("#leaderboard-size").value);
  const period = document.querySelector("#leaderboard-period").value;
  if (!window.goodGridSupabaseConfigured || !supabaseClient) {
    leaderboardRows.innerHTML = '<tr><td colspan="3">Connect Supabase to load rankings.</td></tr>';
    setStatus(document.querySelector("#leaderboard-status"), "Create a project and follow SUPABASE_SETUP.md to enable the leaderboard.", true);
    return;
  }
  leaderboardRows.innerHTML = '<tr><td colspan="3">Loading verified times…</td></tr>';
  setStatus(document.querySelector("#leaderboard-status"), "");
  const { data, error } = await supabaseClient.functions.invoke("leaderboard", { body: { boxSize: box, period } });
  if (error || data?.error) {
    leaderboardRows.innerHTML = '<tr><td colspan="3">Rankings are temporarily unavailable.</td></tr>';
    setStatus(document.querySelector("#leaderboard-status"), data?.error || error.message, true);
    return;
  }
  leaderboardRows.replaceChildren();
  if (!data.entries?.length) {
    const row = leaderboardRows.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = "No verified scores yet. Be the first!";
  }
  for (const entry of data.entries || []) {
    const row = leaderboardRows.insertRow();
    for (const text of [entry.rank, entry.username, formatRankTime(Number(entry.elapsed_ms))]) {
      const cell = row.insertCell();
      cell.textContent = String(text);
    }
  }
  setStatus(document.querySelector("#leaderboard-status"), period === "daily" ? `Daily challenge · ${data.date} UTC · Medium` : `All-time best · ${box}×${box} · Medium`);
}

async function refreshSession(session) {
  const guestSave = !authSession && session ? readCasualState() : null;
  if (!session) {
    casualCloudSyncUserId = null;
    casualCloudSyncPromise = null;
  }
  authSession = session;
  updateAccountStatus();
  if (authSession) await syncCasualCloudSave(authSession, guestSave);
  if (authSession && pendingRankedSize) {
    const size = pendingRankedSize;
    pendingRankedSize = null;
    try { sessionStorage.removeItem("goodgrid-pending-ranked-size"); }
    catch { /* In-memory state is already cleared. */ }
    await startRankedAttempt(size);
  }
}

async function initializeAuth() {
  updateAccountStatus();
  if (!supabaseClient) return;
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => { void refreshSession(session); }, 0);
  });
  const { data } = await supabaseClient.auth.getSession();
  await refreshSession(data.session);
}

document.querySelector("#ranked-button").addEventListener("click", () => {
  showScreen("ranked-screen");
  if (!window.goodGridSupabaseConfigured) showSupabaseSetupMessage();
});

document.querySelector(".brand").addEventListener("click", event => {
  event.preventDefault();
  if (document.querySelector("#game-screen").hidden === false && playMode === "ranked") {
    void leaveRankedGame("home-screen");
    return;
  }
  clearInterval(timerInterval);
  showScreen("home-screen");
});

document.querySelector("#casual-button").addEventListener("click", () => {
  const state = readCasualState();
  if (state && restoreCasualPuzzle(state)) return;
  showScreen("game-screen");
  newPuzzle();
});

document.querySelectorAll(".back-button[data-go]").forEach(button => {
  button.addEventListener("click", () => showScreen(button.dataset.go));
});

document.querySelector("#game-back").addEventListener("click", () => {
  if (playMode === "ranked") {
    void leaveRankedGame("ranked-screen");
    return;
  }
  clearInterval(timerInterval);
  showScreen("home-screen");
});

document.querySelectorAll("[data-ranked-size]").forEach(button => {
  button.addEventListener("click", () => startRankedAttempt(Number(button.dataset.rankedSize)));
});

document.querySelector("#leaderboard-button").addEventListener("click", () => {
  showScreen("leaderboard-screen");
  void loadLeaderboard();
});
document.querySelector("#leaderboard-period").addEventListener("change", loadLeaderboard);
document.querySelector("#leaderboard-size").addEventListener("change", loadLeaderboard);

document.querySelector("#account-action").addEventListener("click", async () => {
  if (authSession && supabaseClient) {
    await supabaseClient.auth.signOut();
    setStatus(rankedStatus, "You have signed out.");
  } else {
    setAuthMode("login");
    showScreen("auth-screen");
  }
});

document.querySelector("#login-tab").addEventListener("click", () => setAuthMode("login"));
document.querySelector("#signup-tab").addEventListener("click", () => setAuthMode("signup"));

document.querySelector("#auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) {
    setStatus(authStatus, "Supabase is not configured yet. Follow SUPABASE_SETUP.md first.", true);
    return;
  }
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const submit = document.querySelector("#auth-submit");
  submit.disabled = true;
  setStatus(authStatus, authMode === "signup" ? "Creating your account…" : authMode === "recovery" ? "Updating your password…" : "Signing in…");
  let result;
  let signupSlowTimer;
  try {
    if (authMode === "signup") {
      const username = document.querySelector("#auth-username").value.trim();
      signupSlowTimer = setTimeout(() => {
        setStatus(authStatus, "Account creation is still waiting for the confirmation email service. Keep this page open and avoid submitting again.");
      }, 10000);
      result = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: window.location.href }
      });
    } else if (authMode === "recovery") {
      result = await supabaseClient.auth.updateUser({ password });
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
    }
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : "The request could not be completed. Check your connection and try again.", true);
    return;
  } finally {
    clearTimeout(signupSlowTimer);
    submit.disabled = false;
  }
  if (result.error) {
    const errorMessage = result.error.message || "The request could not be completed.";
    const isEmailRateLimit = /email rate limit exceeded|over_email_send_rate_limit/i.test(errorMessage);
    setStatus(authStatus, isEmailRateLimit
      ? "Confirmation email limit reached. Wait before retrying, and check your inbox and spam folder for an earlier email. The site owner can configure custom SMTP for higher limits."
      : errorMessage, true);
  } else if (authMode === "signup" && !result.data.session) {
    setStatus(authStatus, "Account created. Check your email to confirm, then return here to sign in.");
  } else if (authMode === "recovery") {
    setAuthMode("login");
    setStatus(authStatus, "Password updated. You can now sign in with your new password.");
  } else if (result.data.session) {
    await refreshSession(result.data.session);
    if (playMode !== "ranked") {
      setStatus(authStatus, "Signed in successfully.");
      showScreen("ranked-screen");
    }
  }
});

document.querySelector("#reset-password").addEventListener("click", async () => {
  if (!supabaseClient) {
    setStatus(authStatus, "Supabase is not configured yet. Follow SUPABASE_SETUP.md first.", true);
    return;
  }
  const email = document.querySelector("#auth-email").value.trim();
  if (!email) {
    setStatus(authStatus, "Enter your email address first.", true);
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
  setStatus(authStatus, error ? error.message : "If an account uses that address, a reset link is on its way.", Boolean(error));
});

// Password recovery redirects back to this page with a recovery session.
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(event => {
    if (event === "PASSWORD_RECOVERY") {
      setAuthMode("recovery");
      showScreen("auth-screen");
      setStatus(authStatus, "Choose a new password for your account.");
    }
  });
}

document.querySelector("#new-puzzle").addEventListener("click", newPuzzle);
sizeSelect.addEventListener("change", newPuzzle);
difficultyButtons.forEach(button => button.addEventListener("click", () => {
  difficulty = button.dataset.difficulty;
  difficultyButtons.forEach(option => {
    const active = option === button;
    option.classList.toggle("selected", active);
    option.setAttribute("aria-pressed", String(active));
  });
  newPuzzle();
}));
mistakesToggle.addEventListener("change", () => {
  if (playMode === "casual") previousMistakesSetting = mistakesToggle.checked;
  renderCells();
});
notesToggle.addEventListener("change", () => {
  messageElement.textContent = notesToggle.checked ? "Notes mode on — choose symbols to pencil them in." : "Notes mode off — choose a symbol to enter an answer.";
});
undoButton.addEventListener("click", undo);
document.querySelector("#erase-button").addEventListener("click", eraseSelected);

document.addEventListener("keydown", event => {
  if (event.target.matches("select, input")) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if (selected < 0) return;
  const row = Math.floor(selected / side);
  const column = selected % side;
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[event.key]) {
    event.preventDefault();
    const [dr, dc] = moves[event.key];
    const nextRow = (row + dr + side) % side;
    const nextColumn = (column + dc + side) % side;
    selectCell(nextRow * side + nextColumn);
  } else if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    eraseSelected();
  } else {
    const value = keyboardValue(event.key);
    if (value !== -1) enterValue(value);
  }
});

const helpDialog = document.querySelector("#help-dialog");
document.querySelector("#help-button").addEventListener("click", () => helpDialog.showModal());
document.querySelector("#close-help").addEventListener("click", () => helpDialog.close());
document.querySelector("#got-it").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", event => { if (event.target === helpDialog) helpDialog.close(); });

window.addEventListener("pagehide", () => {
  if (playMode === "casual" && document.querySelector("#game-screen").hidden === false) pauseCasualTimer();
  persistAppState();
  if (authSession?.user?.id) {
    const userId = authSession.user.id;
    clearTimeout(casualCloudSaveTimer);
    const save = readCasualState();
    if (save) casualCloudSaveInFlight = casualCloudSaveInFlight.catch(() => {}).then(() => writeCasualCloudSave(save, userId));
  }
});

void initializeAuth().then(restoreAppPage);
