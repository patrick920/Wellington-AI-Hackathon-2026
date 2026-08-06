/**
 * providers/gemini.js
 * -------------------
 * Google AI Studio (Gemini) support — the DEFAULT provider for LoopNZ.
 *
 * WHY GEMINI IS THE DEFAULT:
 * Google AI Studio has a genuinely free API tier that does not require a credit
 * card, which matters for a hackathon. Claude is still available as an opt-in
 * (see providers/claude.js) if you have API credits.
 *
 * WHY RAW HTTP INSTEAD OF AN SDK:
 * This file talks to the REST API with plain `fetch`. That keeps the Gemini path
 * at ZERO npm dependencies — the app runs straight from `node server/server.js`
 * with no `npm install` at all. The request shape is documented at:
 *   https://ai.google.dev/api/generate-content
 *
 * THE INTERESTING PART — translating tool calls:
 * LoopNZ defines its tools once, in Anthropic's JSON-Schema style (see TOOLS in
 * server/ai.js). Gemini wants OpenAPI-subset "functionDeclarations" instead, and
 * uses a different message shape for calls and results. Everything in this file
 * below `toGeminiSchema` is that translation. The tools themselves, and
 * `executeTool()`, are shared between providers and never change.
 */

/** Base URL for the Gemini REST API. */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Machine id and human label, used by /api/meta and the UI badge. */
export const id = 'gemini';
export const label = 'Google Gemini';
export const keyUrl = 'https://aistudio.google.com/apikey';

/**
 * Which Gemini model to use.
 *
 * WHY AN ALIAS AND NOT A VERSION NUMBER:
 * Google retires specific model versions, and a retired model keeps appearing in
 * the models list while refusing to actually run ("no longer available to new
 * users"). `gemini-flash-latest` is a moving alias that always points at the
 * current Flash model, so this project keeps working after sitting unused.
 *
 * Verified working on the free tier (see MODEL_CANDIDATES below for the list
 * `npm run check-ai` will test if your configured model fails).
 *
 * Note: the *Pro* models are listed on free keys but return 429 quota errors —
 * they effectively need billing enabled. Stick to Flash unless you have paid.
 */
export function model() {
  return process.env.LOOPNZ_GEMINI_MODEL || 'gemini-flash-latest';
}

/**
 * Models worth trying if the configured one fails, roughly best-first.
 * `npm run check-ai` probes these with a real request so it can tell you which
 * ones your key can genuinely use — the models list endpoint cannot, because it
 * happily reports models that then refuse to run.
 */
export const MODEL_CANDIDATES = [
  'gemini-flash-latest',           // current Flash alias — the default
  'gemini-flash-lite-latest',      // fastest, good for a live demo
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-pro-latest',             // usually 429s without billing
  'gemini-2.0-flash'
];

/**
 * Read the API key. We accept three names because Google's own docs and tools
 * use different ones, and guessing wrong is a frustrating first-run failure.
 */
export function apiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_STUDIO_API_KEY ||
    ''
  );
}

/** True if this provider has what it needs to run. */
export function isConfigured() {
  return Boolean(apiKey());
}

/**
 * How hard the model thinks before answering — the same LOOPNZ_EFFORT setting
 * the Claude provider uses, mapped onto Gemini's thinking budget.
 *
 * Measured on gemini-flash-latest: `low` is roughly 30% faster per call, which
 * across a 2-3 call tool loop is the difference between a demo that feels
 * responsive and one that stalls.
 *
 * Do NOT map anything to a budget of 0 — these models reject it with a 400.
 * `medium` deliberately sends no thinkingConfig at all and lets the model
 * decide, which is both the fastest-to-fail-safe option and a good default.
 */
export function effort() {
  return process.env.LOOPNZ_EFFORT || 'medium';
}

function thinkingConfig() {
  switch (effort()) {
    case 'low': return { thinkingBudget: 512 };
    case 'high': return { thinkingBudget: 4096 };
    default: return null; // medium — let the model choose
  }
}

/** Summary for /api/meta so the front end can show provider status. */
export function describe() {
  return { id, label, model: model(), effort: effort(), keyUrl, envVar: 'GEMINI_API_KEY' };
}

// ---------------------------------------------------------------------------
// Schema translation
// ---------------------------------------------------------------------------

/**
 * Keys Gemini's schema dialect understands. Anything else (notably
 * `additionalProperties` and `$schema`) must be stripped or the API rejects the
 * whole request with a 400.
 *
 * IF YOU HIT A SCHEMA ERROR, THIS FUNCTION IS WHERE TO LOOK.
 */
const ALLOWED_SCHEMA_KEYS = new Set([
  'type', 'format', 'description', 'nullable', 'enum', 'items', 'properties', 'required'
]);

/** Recursively convert a JSON Schema into Gemini's OpenAPI subset. */
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;

  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) continue;

    if (key === 'properties' && value && typeof value === 'object') {
      out.properties = {};
      for (const [prop, propSchema] of Object.entries(value)) {
        const converted = toGeminiSchema(propSchema);
        if (converted) out.properties[prop] = converted;
      }
    } else if (key === 'items') {
      const converted = toGeminiSchema(value);
      if (converted) out.items = converted;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Convert LoopNZ's tool list into Gemini's `functionDeclarations` format.
 *
 * Note the empty-parameters case: `get_statistics` takes no arguments, and
 * sending `parameters: { type: "object", properties: {} }` makes Gemini return a
 * 400. The field has to be omitted entirely instead.
 */
function toGeminiTools(tools) {
  const functionDeclarations = tools.map(tool => {
    const declaration = { name: tool.name, description: tool.description };
    const params = toGeminiSchema(tool.input_schema);
    if (params?.properties && Object.keys(params.properties).length > 0) {
      declaration.parameters = params;
    }
    return declaration;
  });
  return [{ functionDeclarations }];
}

/**
 * `functionResponse.response` must be a JSON object. Most of our tool results
 * already are, but wrap anything else so a stray array or string cannot break
 * the request.
 */
function asResponseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return { result: value };
}

// ---------------------------------------------------------------------------
// The conversation loop
// ---------------------------------------------------------------------------

/**
 * Run one full turn: send the conversation, execute any tools Gemini asks for,
 * feed the results back, and repeat until it produces a final answer.
 *
 * @param {object}   opts
 * @param {string}   opts.system         system instruction
 * @param {Array}    opts.tools          LoopNZ tool definitions (Anthropic shape)
 * @param {Array}    opts.history        [{role:'user'|'assistant', content:string}]
 * @param {string}   opts.userMessage    what the user just typed
 * @param {Function} opts.runTool        (name, input) => { result, action? }
 * @param {number}   [opts.maxIterations]
 * @returns {Promise<{reply:string, actions:Array, toolsUsed:Array}>}
 */
export async function runTurn({ system, tools, history, userMessage, runTool, maxIterations = 6 }) {
  const key = apiKey();
  if (!key) throw new Error('No Gemini API key set. Put GEMINI_API_KEY in your .env file.');

  const geminiTools = toGeminiTools(tools);

  // Gemini calls the assistant role "model", not "assistant".
  const contents = history
    .filter(m => m && m.content)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }]
    }));

  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const actions = [];
  const toolsUsed = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const generationConfig = { maxOutputTokens: 8192 };
    const thinking = thinkingConfig();
    if (thinking) generationConfig.thinkingConfig = thinking;

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: geminiTools,
      generationConfig
    };

    const response = await fetch(`${API_BASE}/models/${model()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      // Surface Google's own error text — it is usually specific and useful
      // ("API key not valid", "model not found", schema complaints).
      const detail = await response.text().catch(() => '');
      throw new Error(friendlyError(response.status, detail));
    }

    const data = await response.json();

    // The safety filter can block the prompt outright before any generation.
    if (data.promptFeedback?.blockReason) {
      return {
        reply: "I can't help with that particular request, but I'm happy to help you find or list waste material.",
        actions, toolsUsed
      };
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);
    const text = parts.filter(p => p.text).map(p => p.text).join('\n').trim();

    // No tool calls means Gemini is finished — this is the final answer.
    if (calls.length === 0) {
      if (!text && candidate?.finishReason === 'MAX_TOKENS') {
        return { reply: 'That answer got too long and was cut off. Could you narrow the question?', actions, toolsUsed };
      }
      if (!text && candidate?.finishReason === 'SAFETY') {
        return { reply: "I can't help with that one, but ask me anything about finding or listing waste material.", actions, toolsUsed };
      }
      return { reply: text || 'Done.', actions, toolsUsed };
    }

    // Echo the model's turn back VERBATIM. Two reasons this must not be
    // rebuilt or filtered: it carries the functionCall parts that the following
    // functionResponse parts answer, and on Gemini 3 models each part can carry
    // a `thoughtSignature` that the API expects to receive back unchanged.
    contents.push({ role: 'model', parts });

    // Run every requested tool, then return ALL results in one turn. Splitting
    // them across separate turns discourages the model from batching calls.
    const responseParts = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      let outcome;
      try {
        outcome = runTool(call.name, call.args || {});
      } catch (err) {
        outcome = { result: { error: err.message } };
      }
      if (outcome.action) actions.push(outcome.action);
      responseParts.push({
        functionResponse: { name: call.name, response: asResponseObject(outcome.result) }
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return {
    reply: 'I looked into that but ran out of steps before finishing. Could you narrow the question slightly?',
    actions,
    toolsUsed
  };
}

/**
 * Turn an HTTP failure into something a hackathon team can act on at 2am,
 * rather than a raw JSON blob.
 */
function friendlyError(status, detail) {
  // Google's own message is usually the most useful thing available — always
  // try to surface it rather than replacing it with a guess.
  let googleMessage = '';
  try {
    googleMessage = JSON.parse(detail)?.error?.message || '';
  } catch {
    googleMessage = (detail || '').slice(0, 300);
  }

  if (status === 400 && /API key not valid/i.test(detail)) {
    return `Gemini rejected the API key. Check GEMINI_API_KEY in your .env — get a fresh one at ${keyUrl}`;
  }
  if (status === 400) {
    return `Gemini rejected the request (400). This is usually a tool-schema problem — see toGeminiSchema() in server/providers/gemini.js. Google said: ${googleMessage}`;
  }
  if (status === 403) {
    return `Gemini denied access (403). The key may not have the Generative Language API enabled. Google said: ${googleMessage}`;
  }
  if (status === 404) {
    // A retired model still appears in the models list but refuses to run, so
    // "check the list" is bad advice here — name a model that actually works.
    const retired = /no longer available/i.test(googleMessage);
    return retired
      ? `The Gemini model "${model()}" has been retired by Google (${googleMessage.trim()}) Set LOOPNZ_GEMINI_MODEL=gemini-flash-latest in your .env, or run "npm run check-ai" to test which models your key can use.`
      : `Gemini model "${model()}" was not found. Run "npm run check-ai" to test which models your key can use, then set LOOPNZ_GEMINI_MODEL in .env. Google said: ${googleMessage}`;
  }
  if (status === 429) {
    // Two very different causes, and the fix differs, so distinguish them.
    const quota = /quota|billing/i.test(googleMessage);
    return quota
      ? `Gemini quota exceeded for "${model()}". The Pro models are not usable on a free key — set LOOPNZ_GEMINI_MODEL=gemini-flash-latest in your .env.`
      : 'Gemini rate limit hit (too many requests per minute). Wait a minute and try again.';
  }
  return `Gemini request failed (${status}). ${googleMessage}`;
}

/**
 * Send the cheapest possible real request to check whether a model works.
 * The models-list endpoint is NOT a reliable signal — it lists retired models
 * that then 404 on use — so `npm run check-ai` calls this instead.
 *
 * @returns {Promise<{ok: boolean, ms?: number, error?: string}>}
 */
export async function probeModel(name) {
  const key = apiKey();
  if (!key) return { ok: false, error: 'No API key set.' };

  const started = Date.now();
  try {
    const response = await fetch(`${API_BASE}/models/${name}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
        generationConfig: { maxOutputTokens: 16 }
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      let message = '';
      try { message = JSON.parse(detail)?.error?.message || ''; } catch { message = detail.slice(0, 120); }
      return { ok: false, error: `HTTP ${response.status} — ${message.slice(0, 110)}` };
    }
    return { ok: true, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * List the models this API key can actually use. Used by `npm run check-ai`
 * so you can fix a wrong model name without guessing.
 */
export async function listModels() {
  const key = apiKey();
  if (!key) throw new Error('No Gemini API key set.');
  const response = await fetch(`${API_BASE}/models`, { headers: { 'x-goog-api-key': key } });
  if (!response.ok) {
    throw new Error(friendlyError(response.status, await response.text().catch(() => '')));
  }
  const data = await response.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
}
