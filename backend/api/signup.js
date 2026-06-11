const { createClient } = require('@supabase/supabase-js');

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

function cleanEnv(value) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function normalizeSupabaseUrl(url) {
  let cleaned = cleanEnv(url);
  cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/rest\/v1.*$/i, '');
  return cleaned;
}

function isPlausibleSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase');
  } catch {
    return false;
  }
}

function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !key) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  if (!isPlausibleSupabaseUrl(url)) {
    throw new Error('INVALID_SUPABASE_URL');
  }

  return { url, key };
}

function getSupabaseClient() {
  const { url, key } = getSupabaseConfig();

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  });
}

function mapSupabaseError(error) {
  const code = error.code || '';
  const message = error.message || '';
  const details = error.details || '';

  console.error('Supabase error:', { code, message, details, hint: error.hint });

  if (
    code === 'PGRST205'
    || message.includes('Could not find the table')
    || message.includes('relation "public.signups" does not exist')
  ) {
    return new Error('TABLE_NOT_FOUND');
  }

  if (
    code === 'PGRST301'
    || message.includes('Invalid API key')
    || message.includes('JWT')
  ) {
    return new Error('AUTH_FAILED');
  }

  if (
    code === '42501'
    || message.includes('permission denied')
  ) {
    return new Error('PERMISSION_DENIED');
  }

  if (
    code === '23505'
    || message.includes('duplicate key')
  ) {
    return new Error('DUPLICATE_SIGNUP');
  }

  return new Error('UNKNOWN');
}

async function saveSignupToSupabase(signup) {
  const { url } = getSupabaseConfig();
  const supabase = getSupabaseClient();

  const { error: probeError } = await supabase
    .from('signups')
    .select('id', { count: 'exact', head: true });

  if (probeError) {
    console.error('Supabase probe error:', probeError, 'project:', url);
    throw mapSupabaseError(probeError);
  }

  const { error } = await supabase.from('signups').insert({
    name: signup.name,
    phone: signup.phone,
    email: signup.email,
  });

  if (error) {
    throw mapSupabaseError(error);
  }
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
      INVALID_SUPABASE_URL: 'SUPABASE_URL 형식이 올바르지 않습니다. Supabase Settings → API의 Project URL(https://xxxxx.supabase.co)을 입력해 주세요.',
      AUTH_FAILED: 'Supabase API 키가 올바르지 않습니다. Service Role Key(service_role secret)를 확인해 주세요.',
      TABLE_NOT_FOUND: 'Vercel에 설정한 SUPABASE_URL 프로젝트에서 public.signups 테이블을 찾을 수 없습니다. Supabase Settings → API의 Project URL과 Vercel 환경변수 URL이 같은 프로젝트인지, Settings → Data API → Exposed schemas에 public이 포함되어 있는지 확인해 주세요.',
      PERMISSION_DENIED: 'Supabase 저장 권한이 없습니다. SQL Editor에서 fix-permissions.sql을 실행해 주세요.',
      DUPLICATE_SIGNUP: '이미 가입된 이메일 또는 전화번호입니다.',
    };

    const message = errorMap[error.message]
      || '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

    const status = error.message === 'DUPLICATE_SIGNUP' ? 409 : 500;

    return res.status(status).json({ error: message });
  }
};
