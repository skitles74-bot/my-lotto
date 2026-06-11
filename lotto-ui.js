function getBallColorClass(num) {
  if (num <= 10) return 'yellow';
  if (num <= 20) return 'blue';
  if (num <= 30) return 'red';
  if (num <= 40) return 'gray';
  return 'green';
}

function createBall(num, options = {}) {
  const { spinning = false, isBonus = false, size = 'normal', highlighted = false } = options;
  const ball = document.createElement('span');
  ball.className = `ball ${getBallColorClass(num)}${spinning ? ' spinning' : ''}${isBonus ? ' bonus' : ''}${size === 'small' ? ' ball-small' : ''}${highlighted ? ' ball-highlight' : ''}`;
  ball.textContent = spinning ? '?' : String(num).padStart(2, '0');
  ball.setAttribute('aria-label', spinning ? '추첨 중' : isBonus ? `보너스 번호 ${num}` : `번호 ${num}`);
  return ball;
}

function renderLineBalls(container, line, options = {}) {
  const { spinning = false, ballSize = 'normal', showBonus = true, highlightNumbers = null } = options;
  const numbers = line.numbers ?? line;
  const bonus = line.bonus ?? line.bonus_no ?? null;
  const highlights = highlightNumbers ? new Set(highlightNumbers) : null;

  numbers.forEach((num) => {
    container.appendChild(createBall(num, {
      spinning,
      size: ballSize,
      highlighted: highlights?.has(num),
    }));
  });

  if (!showBonus || bonus == null) return;

  const plus = document.createElement('span');
  plus.className = ballSize === 'small' ? 'plus plus-small' : 'plus';
  plus.textContent = '+';
  plus.setAttribute('aria-hidden', 'true');

  container.append(plus, createBall(bonus, {
    spinning,
    isBonus: true,
    size: ballSize,
    highlighted: highlights?.has(bonus),
  }));
}
