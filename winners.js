const WINNERS_PAGE_SIZE = 30;
const WINNERS_DATA_URL = 'data/lotto-winners.json';
const MIN_LOTTO_NUMBER = 1;
const MAX_LOTTO_NUMBER = 45;
const MAX_FILTER_NUMBERS = 6;

const winnerSearchInput = document.getElementById('winnerSearch');
const numberFilterInput = document.getElementById('numberFilter');
const numberFilterStatusEl = document.getElementById('numberFilterStatus');
const winnersMetaEl = document.getElementById('winnersMeta');
const winnersListEl = document.getElementById('winnersList');
const loadMoreWinnersBtn = document.getElementById('loadMoreWinners');

let allWinners = [];
let filteredWinners = [];
let visibleCount = 0;
let activeFilterNumbers = [];

function formatDrawDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatPrize(amount) {
  if (!amount) return '-';
  const eok = Math.floor(amount / 100000000);
  const man = Math.round((amount % 100000000) / 10000);
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString('ko-KR')}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만원`;
}

function parseFilterNumbers(input) {
  const tokens = input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { numbers: [], error: null };
  }

  const numbers = [];
  const invalid = [];

  tokens.forEach((token) => {
    const num = parseInt(token, 10);
    if (Number.isNaN(num) || num < MIN_LOTTO_NUMBER || num > MAX_LOTTO_NUMBER) {
      invalid.push(token);
      return;
    }
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  });

  if (invalid.length > 0) {
    return {
      numbers: [],
      error: `1~45 사이 번호만 입력할 수 있습니다. (${invalid.join(', ')})`,
    };
  }

  if (numbers.length > MAX_FILTER_NUMBERS) {
    return {
      numbers: [],
      error: `번호는 최대 ${MAX_FILTER_NUMBERS}개까지 입력할 수 있습니다.`,
    };
  }

  numbers.sort((a, b) => a - b);
  return { numbers, error: null };
}

function getDrawNumbers(draw) {
  return [...draw.numbers, draw.bonus_no];
}

function drawContainsAllNumbers(draw, numbers) {
  const drawNumbers = new Set(getDrawNumbers(draw));
  return numbers.every((num) => drawNumbers.has(num));
}

function updateNumberFilterStatus(numbers, error) {
  if (error) {
    numberFilterStatusEl.hidden = false;
    numberFilterStatusEl.className = 'number-filter-status is-error';
    numberFilterStatusEl.textContent = error;
    return;
  }

  if (numbers.length === 0) {
    numberFilterStatusEl.hidden = true;
    numberFilterStatusEl.textContent = '';
    return;
  }

  numberFilterStatusEl.hidden = false;
  numberFilterStatusEl.className = 'number-filter-status';
  numberFilterStatusEl.textContent = `검색 번호: ${numbers.map((num) => String(num).padStart(2, '0')).join(', ')}`;
}

function createWinnerItem(draw) {
  const item = document.createElement('li');
  item.className = 'winner-item';

  const info = document.createElement('div');
  info.className = 'winner-info';

  const round = document.createElement('span');
  round.className = 'winner-round';
  round.textContent = `${draw.draw_no}회`;

  const date = document.createElement('span');
  date.className = 'winner-date';
  date.textContent = formatDrawDate(draw.date);

  const prize = document.createElement('span');
  prize.className = 'winner-prize';
  const firstDivision = draw.divisions?.[0];
  prize.textContent = firstDivision?.winners
    ? `1등 ${firstDivision.winners}명 · ${formatPrize(firstDivision.prize)}`
    : '';

  if (activeFilterNumbers.length > 0) {
    const matchCount = document.createElement('span');
    matchCount.className = 'winner-match';
    matchCount.textContent = `${activeFilterNumbers.length}개 번호 일치`;
    info.append(round, date, matchCount, prize);
  } else {
    info.append(round, date, prize);
  }

  const balls = document.createElement('div');
  balls.className = 'winner-balls';
  renderLineBalls(balls, {
    numbers: draw.numbers,
    bonus: draw.bonus_no,
  }, {
    ballSize: 'small',
    highlightNumbers: activeFilterNumbers,
  });

  item.append(info, balls);
  return item;
}

function updateWinnersMeta() {
  if (allWinners.length === 0) return;

  const latest = allWinners[allWinners.length - 1];
  const showing = Math.min(visibleCount, filteredWinners.length);

  if (activeFilterNumbers.length > 0) {
    winnersMetaEl.textContent = `${activeFilterNumbers.map((num) => String(num).padStart(2, '0')).join(', ')} 포함 · ${filteredWinners.length}회차 · ${showing}건 표시`;
    return;
  }

  winnersMetaEl.textContent = `1회(2002.12.07) ~ ${latest.draw_no}회 · ${filteredWinners.length}건 중 ${showing}건 표시`;
}

function renderWinners(reset = false) {
  if (reset) {
    winnersListEl.innerHTML = '';
    visibleCount = 0;
  }

  const nextItems = filteredWinners.slice(visibleCount, visibleCount + WINNERS_PAGE_SIZE);

  if (filteredWinners.length === 0) {
    const emptyMessage = activeFilterNumbers.length > 0
      ? '입력한 번호가 모두 포함된 1등 당첨 회차가 없습니다.'
      : '검색 결과가 없습니다.';
    winnersListEl.innerHTML = `<li class="winners-empty">${emptyMessage}</li>`;
    loadMoreWinnersBtn.hidden = true;
    updateWinnersMeta();
    return;
  }

  if (reset && winnersListEl.querySelector('.winners-empty')) {
    winnersListEl.innerHTML = '';
  }

  nextItems.forEach((draw) => {
    winnersListEl.appendChild(createWinnerItem(draw));
  });

  visibleCount += nextItems.length;
  loadMoreWinnersBtn.hidden = visibleCount >= filteredWinners.length;
  updateWinnersMeta();
}

function applyWinnerFilter() {
  const roundQuery = winnerSearchInput.value.trim();
  const { numbers, error } = parseFilterNumbers(numberFilterInput.value);

  updateNumberFilterStatus(numbers, error);

  if (error) {
    filteredWinners = [];
    activeFilterNumbers = [];
    renderWinners(true);
    return;
  }

  activeFilterNumbers = numbers;
  filteredWinners = allWinners.filter((draw) => {
    if (roundQuery) {
      const drawNo = parseInt(roundQuery, 10);
      if (Number.isNaN(drawNo) || draw.draw_no !== drawNo) {
        return false;
      }
    }

    if (numbers.length > 0) {
      return drawContainsAllNumbers(draw, numbers);
    }

    return true;
  }).reverse();

  renderWinners(true);
}

async function loadWinners() {
  try {
    const response = await fetch(WINNERS_DATA_URL);
    if (!response.ok) throw new Error('failed to load');

    allWinners = await response.json();
    applyWinnerFilter();
  } catch {
    winnersMetaEl.textContent = '역대 당첨 번호를 불러오지 못했습니다.';
    winnersListEl.innerHTML = '<li class="winners-empty">데이터를 불러올 수 없습니다. 페이지를 새로고침해 주세요.</li>';
    loadMoreWinnersBtn.hidden = true;
  }
}

winnerSearchInput.addEventListener('input', applyWinnerFilter);
numberFilterInput.addEventListener('input', applyWinnerFilter);
loadMoreWinnersBtn.addEventListener('click', () => renderWinners(false));

loadWinners();
