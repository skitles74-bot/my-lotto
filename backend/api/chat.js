const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `당신은 재미로 로또 번호를 추천하는 한국어 운세 챗봇입니다.
사용자의 생년월일과 오늘 날짜를 바탕으로 띠, 별자리, 숫자 기운을 해석하고 로또 6/45 번호를 추천합니다.

규칙:
- numbers는 1~45 사이 서로 다른 정수 6개를 오름차순으로 반환
- bonus는 numbers에 없는 1~45 사이 정수 1개
- fortune은 오늘의 운세를 2~3문장으로 작성
- explanation은 각 번호(또는 번호 그룹)를 왜 골랐는지 운세와 연결해 4~6문장으로 작성
- 반드시 JSON만 반환하고 다른 텍스트는 포함하지 않음
- 실제 당첨을 보장한다는 표현은 사용하지 않음`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    fortune: { type: 'STRING' },
    numbers: {
      type: 'ARRAY',
      items: { type: 'INTEGER' },
    },
    bonus: { type: 'INTEGER' },
    explanation: { type: 'STRING' },
  },
  required: ['fortune', 'numbers', 'bonus', 'explanation'],
  propertyOrdering: ['fortune', 'numbers', 'bonus', 'explanation'],
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

function getTodayKorean() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul',
  });
}

function isValidBirthDate(value) {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2100) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

function isValidLottoResult(result) {
  if (!result || typeof result !== 'object') return false;

  const { numbers, bonus } = result;
  if (!Array.isArray(numbers) || numbers.length !== 6) return false;

  const all = [...numbers, bonus];
  if (all.some((num) => !Number.isInteger(num) || num < 1 || num > 45)) return false;
  if (new Set(all).size !== 7) return false;

  return typeof result.fortune === 'string'
    && typeof result.explanation === 'string';
}

function buildUserPrompt(birthDate) {
  return `${SYSTEM_PROMPT}

생년월일: ${birthDate}
오늘 날짜: ${getTodayKorean()}

위 정보를 바탕으로 오늘의 운세를 해석하고, 로또 6/45 번호 6개와 보너스 번호 1개를 추천해 주세요.
추천 이유를 운세와 연결지어 설명해 주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "fortune": "오늘의 운세",
  "numbers": [1, 2, 3, 4, 5, 6],
  "bonus": 7,
  "explanation": "추천 이유"
}`;
}

function normalizeLottoResult(raw) {
  const numbers = raw.numbers.map((num) => Number(num)).sort((a, b) => a - b);
  const bonus = Number(raw.bonus);

  return {
    fortune: String(raw.fortune).trim(),
    numbers,
    bonus,
    explanation: String(raw.explanation).trim(),
  };
}

function extractJsonText(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('JSON not found in Gemini response');
    }
    return JSON.parse(match[0]);
  }
}

async function requestGemini(apiKey, model, payload) {
  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini API error (${model}): ${response.status} ${responseText}`);
  }

  const data = JSON.parse(responseText);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const blockReason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason;
    throw new Error(`Gemini API empty response (${model}): ${blockReason || 'unknown'}`);
  }

  return extractJsonText(text);
}

async function callGeminiWithSchema(apiKey, birthDate) {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt(birthDate) }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const errors = [];

  for (const model of GEMINI_MODELS) {
    try {
      const parsed = await requestGemini(apiKey, model, payload);
      return normalizeLottoResult(parsed);
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      console.error(`Structured Gemini call failed (${model}):`, error.message);
    }
  }

  throw new Error(errors.join(' | ') || 'All structured Gemini models failed');
}

async function callGeminiPlainJson(apiKey, birthDate) {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt(birthDate) }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const errors = [];

  for (const model of GEMINI_MODELS) {
    try {
      const parsed = await requestGemini(apiKey, model, payload);
      return normalizeLottoResult(parsed);
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      console.error(`Plain JSON Gemini call failed (${model}):`, error.message);
    }
  }

  throw new Error(errors.join(' | ') || 'All plain JSON Gemini models failed');
}

function parseGeminiErrorBody(message) {
  const jsonMatch = message.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return message;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.error?.message || parsed.message || message;
  } catch {
    return message;
  }
}

function extractHttpStatus(message) {
  const match = message.match(/Gemini API error \([^)]+\): (\d{3})/);
  return match ? Number(match[1]) : null;
}

function toUserFacingError(error) {
  const raw = error?.message || String(error);
  const detail = parseGeminiErrorBody(raw);
  const status = extractHttpStatus(raw);

  if (status === 401 || /API key not valid|API_KEY_INVALID/i.test(detail)) {
    return {
      error: 'Gemini API 키가 올바르지 않습니다. Google AI Studio에서 API 키를 확인해 주세요.',
      code: 'INVALID_API_KEY',
      detail,
    };
  }

  if (status === 429 || /quota|RESOURCE_EXHAUSTED|rate limit/i.test(detail)) {
    return {
      error: 'Gemini API 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
      code: 'QUOTA_EXCEEDED',
      detail,
    };
  }

  if (status === 403 || /PERMISSION_DENIED|permission/i.test(detail)) {
    return {
      error: 'Gemini API 접근 권한이 없습니다. API 키 권한을 확인해 주세요.',
      code: 'PERMISSION_DENIED',
      detail,
    };
  }

  if (/no longer available|deprecated|shutdown/i.test(detail)) {
    return {
      error: '사용 중인 Gemini 모델이 더 이상 지원되지 않습니다. 서비스 업데이트 후 다시 시도해 주세요.',
      code: 'MODEL_DEPRECATED',
      detail,
    };
  }

  if (status === 404 || /not found|NOT_FOUND/i.test(detail)) {
    return {
      error: 'Gemini 모델을 찾을 수 없습니다. API 설정을 확인해 주세요.',
      code: 'MODEL_NOT_FOUND',
      detail,
    };
  }

  if (status === 503 || /UNAVAILABLE|overloaded/i.test(detail)) {
    return {
      error: 'Gemini API 서버가 일시적으로 사용 불가합니다. 잠시 후 다시 시도해 주세요.',
      code: 'SERVICE_UNAVAILABLE',
      detail,
    };
  }

  if (/JSON not found|empty response|SAFETY|blocked/i.test(raw + detail)) {
    return {
      error: 'AI 응답을 처리하지 못했습니다. 입력 내용을 바꿔 다시 시도해 주세요.',
      code: 'INVALID_RESPONSE',
      detail,
    };
  }

  if (/All structured Gemini models failed|All plain JSON Gemini models failed/i.test(raw)) {
    return {
      error: '모든 Gemini 모델 호출에 실패했습니다.',
      code: 'ALL_MODELS_FAILED',
      detail,
    };
  }

  return {
    error: '번호 추천 중 오류가 발생했습니다.',
    code: 'UNKNOWN',
    detail: detail.slice(0, 400),
  };
}

async function callGemini(apiKey, birthDate) {
  try {
    return await callGeminiWithSchema(apiKey, birthDate);
  } catch (schemaError) {
    console.error('Falling back to plain JSON mode:', schemaError.message);
    return callGeminiPlainJson(apiKey, birthDate);
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const { birthDate } = parseRequestBody(req.body);

  if (!isValidBirthDate(birthDate)) {
    return res.status(400).json({ error: '올바른 생년월일(YYYY-MM-DD)을 입력해 주세요.' });
  }

  try {
    const result = await callGemini(apiKey, birthDate);

    if (!isValidLottoResult(result)) {
      return res.status(502).json({
        error: '추천 번호 형식이 올바르지 않습니다. 다시 시도해 주세요.',
        code: 'INVALID_LOTTO_FORMAT',
        detail: `numbers: ${JSON.stringify(result.numbers)}, bonus: ${result.bonus}`,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    const userError = toUserFacingError(error);
    return res.status(500).json(userError);
  }
};
