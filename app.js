"use strict";

const SYMBOLS = "123456789ABCDEFGHIJKLMNOP";
const COLORS = ["", "cell-symbol-1", "cell-symbol-2", "cell-symbol-3", "cell-symbol-4", "cell-symbol-5", "cell-symbol-6", "cell-symbol-7", "cell-symbol-8", "cell-symbol-9"];
const CLUES = {
  easy: { 3: 40, 4: 190, 5: 500 },
  medium: { 3: 32, 4: 155, 5: 425 },
  hard: { 3: 26, 4: 125, 5: 350 }
};

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
let timerInterval;
let completed = false;

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
}

function isWrong(index) {
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
  if (selected < 0 || completed || puzzle[Math.floor(selected / side)][selected % side] !== -1) return;
  saveHistory(selected);
  if (notesToggle.checked) {
    if (notes[selected].has(value)) notes[selected].delete(value);
    else notes[selected].add(value);
  } else {
    values[selected] = value;
    notes[selected].clear();
  }
  renderCells();
  checkCompletion();
}

function eraseSelected() {
  if (selected < 0 || completed || puzzle[Math.floor(selected / side)][selected % side] !== -1) return;
  if (values[selected] === -1 && notes[selected].size === 0) return;
  saveHistory(selected);
  values[selected] = -1;
  notes[selected].clear();
  renderCells();
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  values[previous.index] = previous.value;
  notes[previous.index] = new Set(previous.notes);
  selected = previous.index;
  undoButton.disabled = history.length === 0;
  renderCells();
  checkCompletion();
}

function checkCompletion() {
  const done = values.every((value, index) => value === solution[Math.floor(index / side)][index % side]);
  if (done) {
    completed = true;
    clearInterval(timerInterval);
    messageElement.textContent = "Lovely work — puzzle complete!";
    messageElement.classList.add("success");
  } else if (completed) {
    completed = false;
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
  clearInterval(timerInterval);
  startedAt = Date.now();
  timerElement.textContent = "00:00";
  timerInterval = setInterval(() => {
    timerElement.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
  }, 250);
}

function newPuzzle() {
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
}

function keyboardValue(key) {
  const symbol = key.toUpperCase();
  const value = SYMBOLS.indexOf(symbol);
  return value >= 0 && value < side ? value : -1;
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
mistakesToggle.addEventListener("change", renderCells);
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

newPuzzle();
