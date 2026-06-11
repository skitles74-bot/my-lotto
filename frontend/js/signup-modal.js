const SIGNUP_API_URL = '/api/signup';

const signupModal = document.getElementById('signupModal');
const signupForm = document.getElementById('signupForm');
const signupCloseBtn = document.getElementById('signupCloseBtn');
const signupSkipBtn = document.getElementById('signupSkipBtn');
const signupBackdrop = document.getElementById('signupBackdrop');
const signupErrorEl = document.getElementById('signupError');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');
const signupSuccessEl = document.getElementById('signupSuccess');

let lastFocusedElement = null;

function formatPhoneInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function showSignupError(message) {
  signupErrorEl.hidden = !message;
  signupErrorEl.textContent = message || '';
}

function setSignupLoading(isLoading) {
  signupSubmitBtn.disabled = isLoading;
  signupForm.querySelectorAll('input').forEach((input) => {
    input.disabled = isLoading;
  });
  signupSubmitBtn.textContent = isLoading ? '가입 처리 중...' : '무료 가입하기';
}

function openSignupModal() {
  lastFocusedElement = document.activeElement;
  signupModal.hidden = false;
  document.body.classList.add('modal-open');
  signupSuccessEl.hidden = true;
  signupForm.hidden = false;
  showSignupError('');
  signupForm.reset();

  requestAnimationFrame(() => {
    signupForm.querySelector('#signupName')?.focus();
  });
}

function closeSignupModal() {
  signupModal.hidden = true;
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus();
}

function showSignupSuccess(message) {
  signupForm.hidden = true;
  signupSuccessEl.hidden = false;
  signupSuccessEl.querySelector('.signup-success-text').textContent = message;
  showSignupError('');
}

async function submitSignup(formData) {
  const response = await fetch(SIGNUP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '가입 처리에 실패했습니다.');
  }

  return data;
}

function scheduleSignupModal(delayMs = 1200) {
  window.setTimeout(openSignupModal, delayMs);
}

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showSignupError('');

  const formData = new FormData(signupForm);
  setSignupLoading(true);

  try {
    const result = await submitSignup(formData);
    showSignupSuccess(result.message);
  } catch (error) {
    showSignupError(error.message);
  } finally {
    setSignupLoading(false);
  }
});

signupForm.querySelector('#signupPhone')?.addEventListener('input', (event) => {
  event.target.value = formatPhoneInput(event.target.value);
});

signupCloseBtn.addEventListener('click', closeSignupModal);
signupSkipBtn.addEventListener('click', closeSignupModal);
signupBackdrop.addEventListener('click', closeSignupModal);

signupModal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSignupModal();
  }
});

document.getElementById('signupSuccessCloseBtn')?.addEventListener('click', closeSignupModal);

window.showSignupModal = openSignupModal;
window.scheduleSignupModal = scheduleSignupModal;
