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

function normalizeSupabaseUrl(url) {
  return url.trim().replace(/\/+$/, '');
}

function classifySupabaseError(status, errorText) {
  let payload = {};

  try {
    payload = JSON.parse(errorText);
  } catch {
    payload = { message: errorText };
  }

  const code = payload.code || '';
  const message = payload.message || errorText || '';

  if (status === 401 || message.includes('Invalid API key') || message.includes('JWT')) {
    return 'AUTH_FAILED';
  }

  if (
    status === 404
    || code === 'PGRST205'
    || message.includes('Could not find the table')
    || message.includes('relation "public.signups" does not exist')
  ) {
    return 'TABLE_NOT_FOUND';
  }

  if (
    status === 403
    || code === '42501'
    || message.includes('permission denied')
  ) {
    return 'PERMISSION_DENIED';
  }

  if (
    status === 409
    || code === '23505'
    || message.includes('duplicate key')
  ) {
    return 'DUPLICATE_SIGNUP';
  }

  return 'UNKNOWN';
}

async function saveSignupToSupabase(signup) {
  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/signups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
  const errorType = classifySupabaseError(response.status, errorText);
  console.error('Supabase insert error:', response.status, errorText);
  throw new Error(errorType);
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

    const errorMap = {
      SUPABASE_NOT_CONFIGURED: 'Supabase 환경변수(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.',
      AUTH_FAILED: 'Supabase API 키가 올바르지 않습니다. Service Role Key를 확인해 주세요.',
      TABLE_NOT_FOUND: 'signups 테이블이 없습니다. Supabase SQL Editor에서 schema.sql을 실행해 주세요.',
      PERMISSION_DENIED: 'Supabase 저장 권한이 없습니다. fix-permissions.sql을 실행해 주세요.',
      DUPLICATE_SIGNUP: '이미 가입된 이메일 또는 전화번호입니다.',
    };

    const message = errorMap[error.message]
      || '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

    const status = error.message === 'DUPLICATE_SIGNUP' ? 409 : 500;

    return res.status(status).json({ error: message });
  }
};
