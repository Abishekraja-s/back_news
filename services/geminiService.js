import Setting from '../models/Setting.js';
import {
  DEFAULT_AEO_CONFIG,
  resolveGeminiModel,
} from '../config/aeoDefaults.js';

const SETTING_KEY = 'geminiApiKey';
const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 120000;
const GEMINI_POST_TIMEOUT_MS = Number(process.env.GEMINI_POST_TIMEOUT_MS) || 30000;
const GEMINI_POLL_INTERVAL_MS = 1500;
const GEMINI_API_REVISION = '2026-05-20';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch with AbortSignal timeout — throws a 504-style Error on abort */
const fetchGemini = async (url, options = {}, timeoutMs = GEMINI_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error(
        `Gemini request timed out after ${Math.round(timeoutMs / 1000)} seconds. Try again in a minute.`
      );
      err.statusCode = 504;
      throw err;
    }
    const err = new Error(error?.message || 'Gemini network request failed');
    err.statusCode = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const parseGeminiResponseBody = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const throwGeminiHttpError = (response, payload = {}) => {
  const apiCode = payload?.error?.code;
  const apiMessage = payload?.error?.message || payload?.message || '';

  if (response.status === 429 || apiCode === 'too_many_requests' || /quota exceeded/i.test(apiMessage)) {
    const err = new Error(
      'Gemini API quota exceeded (free tier limit). Wait about 1 minute and try again, or upgrade your Google AI plan.'
    );
    err.statusCode = 429;
    throw err;
  }

  const msg = apiMessage || `Gemini API error (${response.status})`;
  const err = new Error(msg);
  err.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
  throw err;
};

/** Poll GET /interactions/{id} until completed, failed, or deadline */
const pollInteractionUntilDone = async (interactionId, apiKey, deadlineMs) => {
  const pollUrl = `${INTERACTIONS_URL}/${encodeURIComponent(interactionId)}`;

  while (Date.now() < deadlineMs) {
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) break;

    const response = await fetchGemini(
      pollUrl,
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
          'Api-Revision': GEMINI_API_REVISION,
        },
      },
      Math.min(20000, remaining)
    );

    const payload = await parseGeminiResponseBody(response);
    if (!response.ok) throwGeminiHttpError(response, payload);

    if (payload.status === 'completed' || payload.status === 'failed' || payload.status === 'incomplete') {
      return payload;
    }

    await sleep(GEMINI_POLL_INTERVAL_MS);
  }

  const err = new Error(
    `Gemini did not finish within ${Math.round(GEMINI_REQUEST_TIMEOUT_MS / 1000)} seconds. Try again in a minute.`
  );
  err.statusCode = 504;
  throw err;
};

export const maskApiKey = (key = '') => {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return `••••••••${key.slice(-4)}`;
};

/** Resolve API key: env wins, then DB setting. Never log the raw key. */
export const resolveGeminiApiKey = async () => {
  const fromEnv = (process.env.GEMINI_API_KEY || '').trim();
  if (fromEnv) return { key: fromEnv, source: 'env' };

  const row = await Setting.findOne({ key: SETTING_KEY }).lean();
  const fromDb = typeof row?.value === 'string' ? row.value.trim() : '';
  if (fromDb) return { key: fromDb, source: 'database' };

  return { key: '', source: 'none' };
};

export const saveGeminiApiKey = async (apiKey) => {
  const value = String(apiKey || '').trim();
  if (!value) {
    await Setting.deleteOne({ key: SETTING_KEY });
    return { cleared: true };
  }
  await Setting.findOneAndUpdate(
    { key: SETTING_KEY },
    { key: SETTING_KEY, value, group: 'secrets' },
    { upsert: true, new: true }
  );
  return { cleared: false, masked: maskApiKey(value) };
};

const extractBalancedJsonObject = (text = '') => {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
};

/** Parse JSON from Gemini text — handles raw JSON, ```json blocks, and embedded objects */
export const parseGeminiJson = (text = '') => {
  if (text == null || typeof text !== 'string') {
    throw new Error('Gemini response did not contain JSON');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Gemini response did not contain JSON');
  }

  try {
    const direct = JSON.parse(trimmed);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  } catch {
    /* try other strategies */
  }

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks = [];
  let match = fenceRegex.exec(trimmed);
  while (match) {
    blocks.push(match[1].trim());
    match = fenceRegex.exec(trimmed);
  }

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(blocks[i]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      const balanced = extractBalancedJsonObject(blocks[i]);
      if (balanced) return balanced;
    }
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) return balanced;

  throw new Error('Gemini response did not contain JSON');
};

const validateAeoPayload = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Gemini response did not contain a valid JSON object');
  }
  return data;
};

const buildAeoJsonSchema = (targetType = 'page') => {
  const schema = {
    type: 'object',
    properties: {
      metaTitle: { type: 'string' },
      metaDescription: { type: 'string' },
      focusKeyword: { type: 'string' },
      secondaryKeywords: { type: 'array', items: { type: 'string' } },
      h1: { type: 'string' },
      headings: { type: 'array', items: { type: 'string' } },
      directAnswer: { type: 'string' },
      aiSummary: { type: 'string' },
      entities: { type: 'array', items: { type: 'string' } },
      faqs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['question', 'answer'],
        },
      },
      ogTitle: { type: 'string' },
      ogDescription: { type: 'string' },
      canonicalSuggestion: { type: 'string' },
      internalLinks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
          },
          required: ['url'],
        },
      },
      robots: { type: 'string' },
    },
    required: ['metaTitle', 'metaDescription', 'h1', 'directAnswer', 'aiSummary'],
  };

  if (targetType === 'article') {
    schema.properties.excerpt = { type: 'string' };
    schema.properties.content = { type: 'string' };
    schema.properties.slugSuggestion = { type: 'string' };
    schema.properties.tags = { type: 'array', items: { type: 'string' } };
    schema.required.push('excerpt', 'content', 'slugSuggestion');
  }

  return schema;
};

const buildResponseFormat = (targetType = 'page') => ({
  type: 'text',
  mime_type: 'application/json',
  schema: buildAeoJsonSchema(targetType),
});

const extractInteractionText = (payload = {}) => {
  if (payload.output_text) return String(payload.output_text);

  const texts = [];
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  for (const step of steps) {
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const part of step.content) {
      if (part?.type === 'text' && part.text) texts.push(String(part.text));
    }
  }

  if (texts.length) return texts.join('\n').trim();
  return '';
};

/** POST background interaction, then poll until output is ready */
const createGeminiInteraction = async ({ body, apiKey, timeoutMs = GEMINI_REQUEST_TIMEOUT_MS }) => {
  const deadlineMs = Date.now() + timeoutMs;

  const response = await fetchGemini(
    INTERACTIONS_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Api-Revision': GEMINI_API_REVISION,
      },
      body: JSON.stringify({ ...body, background: true }),
    },
    Math.min(GEMINI_POST_TIMEOUT_MS, timeoutMs)
  );

  const payload = await parseGeminiResponseBody(response);
  if (!response.ok) throwGeminiHttpError(response, payload);

  if (payload.status === 'completed' || payload.status === 'failed' || payload.status === 'incomplete') {
    return payload;
  }

  if (extractInteractionText(payload)) {
    return { ...payload, status: payload.status || 'completed' };
  }

  if (!payload?.id) {
    const err = new Error('Gemini did not return an interaction id');
    err.statusCode = 502;
    throw err;
  }

  return pollInteractionUntilDone(payload.id, apiKey, deadlineMs);
};

const parseInteractionPayload = (payload = {}) => {
  const chunks = [];
  if (payload.output_text) chunks.push(String(payload.output_text));

  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  for (const step of steps) {
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const part of step.content) {
      if (part?.type === 'text' && part.text) chunks.push(String(part.text));
    }
  }

  const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];
  for (const out of outputs) {
    if (out?.text) chunks.push(String(out.text));
    if (Array.isArray(out?.content)) {
      for (const part of out.content) {
        if (part?.text) chunks.push(String(part.text));
      }
    }
  }

  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    try {
      return validateAeoPayload(parseGeminiJson(chunks[i]));
    } catch {
      /* try earlier chunk */
    }
  }

  const combined = chunks.join('\n').trim();
  if (combined) return validateAeoPayload(parseGeminiJson(combined));

  throw new Error('Gemini response did not contain JSON');
};

const buildSystemPrompt = (language = 'ta', targetType = 'page') => {
  const langLabel = language === 'ta' ? 'Tamil (தமிழ்)' : 'English';
  const articleNote =
    targetType === 'article'
      ? `
This output is for the Add/Edit Article form. Populate every field accurately for the given topic.
Use h1 as the article headline, excerpt as a short summary (1-2 sentences), and content as brief HTML (2-3 short paragraphs, 2 question-style h2 headings max).
Use metaDescription for SEO meta. slugSuggestion: URL-safe slug. tags: 3-5 tags. faqs: 3 items max. Omit jsonLd.`
      : '';

  return `You are an expert SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) specialist for a Tamil news portal "The Great India News".
${articleNote}
CRITICAL OUTPUT RULES:
- Return ONLY one valid JSON object.
- Do NOT wrap in markdown code fences.
- Do NOT add any text, explanation, or commentary before or after the JSON.
- The response MUST start with { and end with }.

Required JSON schema:
{
  "metaTitle": "string 30-60 chars",
  "metaDescription": "string 120-160 chars",
  "focusKeyword": "string",
  "secondaryKeywords": ["string"],
  "h1": "string",
  "headings": ["question-style H2/H3"],
  "directAnswer": "concise AEO answer 40-300 chars for AI Overviews",
  "aiSummary": "GEO-friendly factual summary 2-4 sentences with clear attribution",
  "entities": ["named entities"],
  "faqs": [{"question":"string","answer":"string"}],
  "ogTitle": "string",
  "ogDescription": "string",
  "canonicalSuggestion": "path like /news/slug",
  "internalLinks": [{"label":"string","url":"/path"}],
  "robots": "index,follow"${targetType === 'article' ? `,
  "excerpt": "short article summary",
  "content": "<p>HTML article body with headings and paragraphs</p>",
  "slugSuggestion": "url-safe-slug",
  "tags": ["tag1", "tag2"]` : ''}
}
Content rules:
- Primary content language: ${langLabel}.
- Include 3 FAQs suitable for FAQPage schema.
- Headings should be conversational / question-style for AEO.
- Entities should be real people, places, organizations, topics.
- Internal links should use plausible site paths (/politics, /tamil-nadu, /news/...).
- jsonLd is optional; omit it to keep the response fast.
- Do not invent unverifiable live facts; keep news framing general when context is thin.`;
};

/**
 * Call Gemini Interactions API (v1beta).
 * @returns {{ data: object, usage: object, model: string, latencyMs: number, rawText: string }}
 */
export const generateAeoGeoContent = async ({
  topic,
  context = {},
  config = {},
  apiKey,
}) => {
  const key = apiKey || (await resolveGeminiApiKey()).key;
  if (!key) {
    const err = new Error('Gemini API key is not configured. Add GEMINI_API_KEY or set it in AEO settings.');
    err.statusCode = 400;
    throw err;
  }

  const model = resolveGeminiModel(config.geminiModel || 'gemini-3.6-flash');
  const language = config.geminiLanguage || 'ta';
  const targetType = context.targetType || 'page';
  const maxOutputTokens = Number(config.geminiMaxOutputTokens ?? 4096);
  const configuredThinking = ['minimal', 'low', 'medium', 'high'].includes(config.geminiThinkingLevel)
    ? config.geminiThinkingLevel
    : 'medium';
  const thinkingLevel =
    targetType === 'article' || targetType === 'preview' ? 'minimal' : configuredThinking;
  const effectiveMaxTokens =
    targetType === 'article' ? Math.min(maxOutputTokens, 1024) : maxOutputTokens;
  const requestTimeoutMs =
    targetType === 'article' ? Math.max(GEMINI_REQUEST_TIMEOUT_MS, 120000) : GEMINI_REQUEST_TIMEOUT_MS;

  const userInput = [
    `Topic / page title: ${topic}`,
    context.path ? `Page path: ${context.path}` : '',
    context.pageType ? `Page type: ${context.pageType}` : '',
    context.excerpt ? `Excerpt: ${context.excerpt}` : '',
    context.contentSnippet ? `Content snippet: ${String(context.contentSnippet).slice(0, 4000)}` : '',
    context.focusKeyword ? `Preferred focus keyword: ${context.focusKeyword}` : '',
    targetType === 'article'
      ? 'Target: news article editor. Return JSON object only — no markdown fences.'
      : 'Generate complete AEO/GEO optimization package as JSON.',
  ]
    .filter(Boolean)
    .join('\n');

  const started = Date.now();

  const payload = await createGeminiInteraction({
    apiKey: key,
    timeoutMs: requestTimeoutMs,
    body: {
      model,
      input: userInput,
      system_instruction: buildSystemPrompt(language, targetType),
      response_format: buildResponseFormat(targetType),
      generation_config: {
        max_output_tokens: effectiveMaxTokens,
        thinking_level: thinkingLevel,
      },
    },
  });

  const latencyMs = Date.now() - started;

  if (payload.status === 'failed') {
    const msg = payload?.error?.message || 'Gemini interaction failed';
    const err = new Error(msg);
    err.statusCode = 502;
    throw err;
  }

  const rawText = extractInteractionText(payload);

  if (!rawText && payload.status !== 'completed') {
    const err = new Error(
      payload.status === 'incomplete'
        ? 'Gemini returned incomplete content (try increasing max output tokens)'
        : 'Gemini returned empty content'
    );
    err.statusCode = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = rawText ? validateAeoPayload(parseGeminiJson(rawText)) : parseInteractionPayload(payload);
  } catch (parseError) {
    try {
      parsed = parseInteractionPayload(payload);
    } catch {
      const err = new Error(parseError.message || 'Gemini response did not contain JSON');
      err.statusCode = 502;
      throw err;
    }
  }

  const data = parsed;
  const usageMeta = payload?.usage || {};

  return {
    data: normalizeGenerated(data),
    usage: {
      promptTokens: usageMeta.total_input_tokens || 0,
      outputTokens: usageMeta.total_output_tokens || 0,
      totalTokens: usageMeta.total_tokens || 0,
    },
    model,
    latencyMs,
    rawText: rawText || JSON.stringify(data),
  };
};

const normalizeGenerated = (data = {}) => ({
  metaTitle: data.metaTitle || data.seoTitle || '',
  metaDescription: data.metaDescription || '',
  focusKeyword: data.focusKeyword || '',
  secondaryKeywords: Array.isArray(data.secondaryKeywords) ? data.secondaryKeywords : [],
  h1: data.h1 || '',
  headings: Array.isArray(data.headings) ? data.headings : [],
  directAnswer: data.directAnswer || '',
  aiSummary: data.aiSummary || '',
  entities: Array.isArray(data.entities) ? data.entities : [],
  faqs: Array.isArray(data.faqs)
    ? data.faqs
        .filter((f) => f?.question && f?.answer)
        .map((f) => ({ question: String(f.question), answer: String(f.answer) }))
    : [],
  ogTitle: data.ogTitle || data.metaTitle || '',
  ogDescription: data.ogDescription || data.metaDescription || '',
  canonicalSuggestion: data.canonicalSuggestion || '',
  internalLinks: Array.isArray(data.internalLinks)
    ? data.internalLinks
        .filter((l) => l?.url)
        .map((l) => ({ label: l.label || l.url, url: l.url }))
    : [],
  jsonLd: data.jsonLd && typeof data.jsonLd === 'object' ? data.jsonLd : null,
  robots: data.robots || 'index,follow',
  excerpt: data.excerpt || data.metaDescription || '',
  content: data.content || '',
  slugSuggestion: data.slugSuggestion || '',
  tags: Array.isArray(data.tags) ? data.tags : [],
});

export const testGeminiConnection = async (config = {}) => {
  const { key, source } = await resolveGeminiApiKey();
  if (!key) {
    return { ok: false, source, message: 'No API key configured' };
  }
  try {
    const result = await generateAeoGeoContent({
      topic: 'Tamil Nadu news portal connectivity test',
      context: { pageType: 'home', path: '/' },
      config: { ...config, geminiMaxOutputTokens: 512 },
      apiKey: key,
    });
    return {
      ok: true,
      source,
      model: result.model,
      latencyMs: result.latencyMs,
      maskedKey: maskApiKey(key),
    };
  } catch (error) {
    return {
      ok: false,
      source,
      maskedKey: maskApiKey(key),
      message: error.message,
    };
  }
};
