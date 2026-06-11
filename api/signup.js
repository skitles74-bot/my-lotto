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

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

async function saveSignupToSupabase(signup) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/signups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      name: signup.name,
      phone: signup.phone,
      email: signup.email,
    }),
  });

  if (response.ok) {
    return;
  }

  const errorText = await response.text();

  if (response.status === 409 || errorText.includes('duplicate key')) {
    throw new Error('DUPLICATE_SIGNUP');
  }

  throw new Error(`Supabase insert failed: ${response.status} ${errorText}`);
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

  const { name, phone, email } = parseRequestBody(req.body);

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
  };

  try {
    await saveSignupToSupabase(signup);

    return res.status(200).json({
      message: '가입이 완료되었습니다. AI 로또 번호 추천 서비스를 곧 이용하실 수 있습니다.',
    });
  } catch (error) {
    console.error('Signup API error:', error);

    if (error.message === 'SUPABASE_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' });
    }

    if (error.message === 'DUPLICATE_SIGNUP') {
      return res.status(409).json({ error: '이미 가입된 이메일 또는 전화번호입니다.' });
    }

    return res.status(500).json({ error: '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
};
