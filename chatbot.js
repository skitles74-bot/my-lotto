const CHAT_API_URL = '/api/chat';

const chatForm = document.getElementById('chatForm');
const birthDateInput = document.getElementById('birthDate');
const chatMessagesEl = document.getElementById('chatMessages');
const chatSubmitBtn = document.getElementById('chatSubmitBtn');

function createMessageElement(type, contentNode) {
  const message = document.createElement('div');
  message.className = `chat-message chat-message-${type}`;

  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  avatar.textContent = type === 'bot' ? '🔮' : '🙂';
  avatar.setAttribute('aria-hidden', 'true');

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.appendChild(contentNode);

  message.append(avatar, bubble);
  return message;
}

function createTextBlock(text) {
  const paragraph = document.createElement('p');
  paragraph.className = 'chat-text';
  paragraph.textContent = text;
  return paragraph;
}

function createRecommendationContent(result) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-recommendation';

  const fortuneTitle = document.createElement('h3');
  fortuneTitle.className = 'chat-subtitle';
  fortuneTitle.textContent = '오늘의 운세';

  const fortuneText = createTextBlock(result.fortune);

  const numbersTitle = document.createElement('h3');
  numbersTitle.className = 'chat-subtitle';
  numbersTitle.textContent = '추천 번호';

  const balls = document.createElement('div');
  balls.className = 'chat-balls';
  renderLineBalls(balls, {
    numbers: result.numbers,
    bonus: result.bonus,
  }, { ballSize: 'small' });

  const explanationTitle = document.createElement('h3');
  explanationTitle.className = 'chat-subtitle';
  explanationTitle.textContent = '추천 이유';

  const explanationText = createTextBlock(result.explanation);

  wrapper.append(
    fortuneTitle,
    fortuneText,
    numbersTitle,
    balls,
    explanationTitle,
    explanationText
  );

  return wrapper;
}

function appendUserMessage(text) {
  chatMessagesEl.appendChild(createMessageElement('user', createTextBlock(text)));
  scrollChatToBottom();
}

function appendBotMessage(contentNode) {
  chatMessagesEl.appendChild(createMessageElement('bot', contentNode));
  scrollChatToBottom();
}

function appendBotError(text) {
  const error = document.createElement('p');
  error.className = 'chat-text chat-error';
  error.textContent = text;
  appendBotMessage(error);
}

function appendLoadingMessage() {
  const loading = document.createElement('p');
  loading.className = 'chat-text chat-loading';
  loading.textContent = '운세를 분석하고 번호를 추천하는 중...';
  const message = createMessageElement('bot', loading);
  message.dataset.loading = 'true';
  chatMessagesEl.appendChild(message);
  scrollChatToBottom();
  return message;
}

function removeLoadingMessage(message) {
  message.remove();
}

function scrollChatToBottom() {
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function formatBirthDateLabel(value) {
  const [year, month, day] = value.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function setChatLoading(isLoading) {
  chatSubmitBtn.disabled = isLoading;
  birthDateInput.disabled = isLoading;
  chatSubmitBtn.textContent = isLoading ? '추천 중...' : '번호 추천받기';
}

async function requestRecommendation(birthDate) {
  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthDate }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '번호 추천에 실패했습니다.');
  }

  return data;
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const birthDate = birthDateInput.value.trim();
  if (!birthDate) {
    appendBotError('생년월일을 입력해 주세요.');
    return;
  }

  appendUserMessage(`${formatBirthDateLabel(birthDate)}생 기준으로 로또 번호를 추천해 주세요.`);

  const loadingMessage = appendLoadingMessage();
  setChatLoading(true);

  try {
    const result = await requestRecommendation(birthDate);
    removeLoadingMessage(loadingMessage);
    appendBotMessage(createRecommendationContent(result));
    scheduleSignupModal();
  } catch (error) {
    removeLoadingMessage(loadingMessage);
    appendBotError(error.message);
  } finally {
    setChatLoading(false);
  }
});

appendBotMessage(createTextBlock('생년월일을 입력하면 오늘의 운세와 함께 로또 번호를 추천해 드립니다.'));

birthDateInput.max = new Date().toISOString().split('T')[0];
birthDateInput.min = '1900-01-01';
