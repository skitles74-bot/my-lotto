const MIN_NUMBER = 1;
const MAX_NUMBER = 45;
const NUMBERS_PER_LINE = 6;
const MAX_LINES = 10;
const SPIN_DURATION_MS = 1200;
const HISTORY_KEY = 'lotto-history';
const MAX_HISTORY = 20;

const lineCountInput = document.getElementById('lineCount');
const decreaseBtn = document.getElementById('decreaseLines');
const increaseBtn = document.getElementById('increaseLines');
const drawBtn = document.getElementById('drawBtn');
const resultsEl = document.getElementById('results');
const historyEl = document.getElementById('history');
const clearHistoryBtn = document.getElementById('clearHistory');

function createResultRow(line, rowIndex, spinning = false) {
  const row = document.createElement('div');
  row.className = 'result-row';

  const label = document.createElement('span');
  label.className = 'row-label';
  label.textContent = `${rowIndex + 1}행`;

  const balls = document.createElement('div');
  balls.className = 'balls';
  renderLineBalls(balls, line, { spinning });

  row.append(label, balls);
  return row;
}

function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function normalizeLine(line) {
  if (Array.isArray(line)) {
    return { numbers: line, bonus: null };
  }
  return line;
}

function renderHistory() {
  const history = loadHistory();
  historyEl.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = '아직 추첨 기록이 없습니다.';
    historyEl.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'history-item';

    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = formatTime(new Date(entry.time));

    const ballsWrap = document.createElement('div');
    ballsWrap.className = 'history-balls';

    entry.lines.forEach((line, index) => {
      if (index > 0) {
        const divider = document.createElement('span');
        divider.className = 'history-divider';
        divider.textContent = '|';
        ballsWrap.appendChild(divider);
      }
      renderLineBalls(ballsWrap, normalizeLine(line), { ballSize: 'small' });
    });

    item.append(time, ballsWrap);
    historyEl.appendChild(item);
  });
}

function generateLine() {
  const pool = Array.from({ length: MAX_NUMBER }, (_, i) => i + MIN_NUMBER);
  const main = [];

  for (let i = 0; i < NUMBERS_PER_LINE; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    main.push(pool.splice(idx, 1)[0]);
  }

  const bonusIdx = Math.floor(Math.random() * pool.length);
  const bonus = pool[bonusIdx];

  return {
    numbers: main.sort((a, b) => a - b),
    bonus,
  };
}

function addToHistory(lines) {
  const history = loadHistory();
  history.unshift({ time: Date.now(), lines });
  saveHistory(history);
  renderHistory();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function draw() {
  const lineCount = parseInt(lineCountInput.value, 10);
  drawBtn.disabled = true;
  resultsEl.innerHTML = '';

  const allLines = Array.from({ length: lineCount }, () => generateLine());

  for (let i = 0; i < lineCount; i++) {
    resultsEl.appendChild(
      createResultRow(
        { numbers: Array(NUMBERS_PER_LINE).fill(0), bonus: 0 },
        i,
        true
      )
    );
  }

  await sleep(SPIN_DURATION_MS);

  resultsEl.innerHTML = '';
  allLines.forEach((line, i) => {
    resultsEl.appendChild(createResultRow(line, i));
  });

  addToHistory(allLines);
  drawBtn.disabled = false;
  window.scheduleSignupModal?.(1200);
}

function updateLineCount(delta) {
  const current = parseInt(lineCountInput.value, 10);
  const next = Math.min(MAX_LINES, Math.max(1, current + delta));
  lineCountInput.value = next;
}

decreaseBtn.addEventListener('click', () => updateLineCount(-1));
increaseBtn.addEventListener('click', () => updateLineCount(1));
drawBtn.addEventListener('click', draw);
clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

renderHistory();
