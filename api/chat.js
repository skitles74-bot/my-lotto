const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
  type: 'object',
  properties: {
    fortune: { type: 'string' },
    numbers: {
      type: 'array',
      items: { type: 'integer' },
    },
    bonus: { type: 'integer' },
    explanation: { type: 'string' },
  },
  required: ['fortune', 'numbers', 'bonus', 'explanation'],
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  return `생년월일: ${birthDate}
오늘 날짜: ${getTodayKorean()}

위 정보를 바탕으로 오늘의 운세를 해석하고, 로또 6/45 번호 6개와 보너스 번호 1개를 추천해 주세요.
추천 이유를 운세와 연결지어 설명해 주세요.`;
}

async function callGemini(apiKey, birthDate) {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(birthDate) }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API returned empty response');
  }

  const parsed = JSON.parse(text);
  parsed.numbers = [...parsed.numbers].sort((a, b) => a - b);
  return parsed;
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

  const { birthDate } = req.body ?? {};

  if (!isValidBirthDate(birthDate)) {
    return res.status(400).json({ error: '올바른 생년월일(YYYY-MM-DD)을 입력해 주세요.' });
  }

  try {
    const result = await callGemini(apiKey, birthDate);

    if (!isValidLottoResult(result)) {
      return res.status(502).json({ error: '추천 번호 형식이 올바르지 않습니다. 다시 시도해 주세요.' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: '번호 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
};
