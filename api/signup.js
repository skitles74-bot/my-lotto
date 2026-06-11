function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

function isValidPhone(value) {
  const digits = normalizePhone(value);
  return /^01[016789]\d{7,8}$/.test(digits);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidName(value) {
  return value.trim().length >= 2;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  const { name, phone, email } = req.body ?? {};

  if (!isValidName(name)) {
    return res.status(400).json({ error: '이름을 2자 이상 입력해 주세요.' });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: '올바른 전화번호를 입력해 주세요.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일 주소를 입력해 주세요.' });
  }

  const signup = {
    name: name.trim(),
    phone: normalizePhone(phone),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };

  console.log('New signup:', signup);

  return res.status(200).json({
    message: '가입이 완료되었습니다. AI 로또 번호 추천 서비스를 곧 이용하실 수 있습니다.',
  });
};
