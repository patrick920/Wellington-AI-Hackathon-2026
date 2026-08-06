/**
 * providers/claude.js
 * -------------------
 * Anthropic Claude support — the OPT-IN provider.
 *
 * Gemini is the default because it has a free tier (see providers/gemini.js).
 * Use this one if you have Anthropic API credits: set ANTHROPIC_API_KEY in .env
 * and either remove GEMINI_API_KEY or set LOOPNZ_PROVIDER=claude.
 *
 * Unlike the Gemini provider, this uses the official SDK (`@anthropic-ai/sdk`),
 * so it needs `npm install` to have been run. The import is dynamic, so a
 * missing node_modules folder degrades gracefully instead of crashing the
 * server.
 */

export const id = 'claude';
export const label = 'Anthropic Claude';
export const keyUrl = 'https://console.anthropic.com/settings/keys';

/**
 * Which Claude model to use.
 * `claude-sonnet-5` is the cost-effective choice; `claude-opus-5` is the most
 * capable. LOOPNZ_MODEL is still honoured as a legacy name for this setting.
 */
export function model() {
  return process.env.LOOPNZ_CLAUDE_MODEL || process.env.LOOPNZ_MODEL || 'claude-sonnet-5';
}

/**
 * How hard the model thinks before answering:
 *   low = snappiest (good for a live demo), medium = balanced, high = thorough.
 */
export function effort() {
  return process.env.LOOPNZ_EFFORT || 'medium';
}

export function apiKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

export function isConfigured() {
  return Boolean(apiKey());
}

export function describe() {
  return { id, label, model: model(), effort: effort(), keyUrl, envVar: 'ANTHROPIC_API_KEY' };
}

/** Cached SDK client, created on first use. */
let client = null;
let loadAttempted = false;

/**
 * Build the Anthropic client. Returns null if the SDK is not installed, which
 * the caller treats the same as "not configured".
 */
async function getClient() {
  if (client) return client;

  // Note the ordering: we only mark the load as "attempted" once a key is
  // actually present. Caching a no-key result would mean that if the
  // environment is populated later in the process's life, we would keep
  // returning null forever.
  if (!apiKey()) return null;
  if (loadAttempted) return client;
  loadAttempted = true;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
    return client;
  } catch {
    console.log('[ai] @anthropic-ai/sdk is not installed. Run "npm install" to use the Claude provider.');
    return null;
  }
}

/** True only if the key exists AND the SDK is importable. */
export async function isAvailable() {
  return (await getClient()) !== null;
}

/**
 * Run one full turn, including the agentic tool loop.
 * Same contract as the Gemini provider — see providers/gemini.js for the
 * parameter documentation.
 */
export async function runTurn({ system, tools, history, userMessage, runTool, maxIterations = 6 }) {
  const anthropic = await getClient();
  if (!anthropic) {
    throw new Error('Claude is not available. Set ANTHROPIC_API_KEY in .env and run "npm install".');
  }

  const messages = history
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));

  messages.push({ role: 'user', content: userMessage });

  const actions = [];
  const toolsUsed = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await anthropic.messages.create({
      model: model(),
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: system,
          // The system prompt and tool definitions are identical on every
          // request, so cache them and pay full price only once.
          cache_control: { type: 'ephemeral' }
        }
      ],
      output_config: { effort: effort() },
      tools,
      messages
    });

    if (response.stop_reason !== 'tool_use') {
      // Safety classifiers can decline a request. Check this before reading
      // content, which may be empty on a refusal.
      if (response.stop_reason === 'refusal') {
        return {
          reply: "I can't help with that particular request, but I'm happy to help you find or list waste material.",
          actions, toolsUsed
        };
      }
      const reply = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim();
      return { reply: reply || 'Done.', actions, toolsUsed };
    }

    // Echo the assistant turn back — it carries the tool_use blocks.
    messages.push({ role: 'assistant', content: response.content });

    // All tool results go back in ONE user message. Splitting them teaches the
    // model to stop making parallel tool calls.
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      toolsUsed.push(block.name);
      let outcome;
      try {
        outcome = runTool(block.name, block.input || {});
      } catch (err) {
        outcome = { result: { error: err.message } };
      }
      if (outcome.action) actions.push(outcome.action);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(outcome.result)
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    reply: 'I looked into that but ran out of steps before finishing. Could you narrow the question slightly?',
    actions,
    toolsUsed
  };
}
