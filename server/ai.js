/**
 * ai.js
 * -----
 * The AI brain of LoopNZ.
 *
 * THE BIG IDEA:
 * The chatbot is not a separate help widget bolted onto the side. It is given
 * *tools* that operate on the same marketplace the human uses. Two kinds:
 *
 *   1. DATA TOOLS  — run here on the server, against db.js. The AI genuinely
 *                    searches the real listings, reads real statistics, and
 *                    creates real records. It cannot make listings up.
 *
 *   2. UI TOOLS    — the AI calls them, we record them as "actions", and the
 *                    browser executes them after rendering the reply. This is
 *                    how the AI can navigate the site, apply filters, open a
 *                    listing, or pre-fill the listing form for you.
 *
 * So when a user says "find me something I could make bioplastic from, near
 * Christchurch", the AI actually runs the search, then actually navigates the
 * page and applies the filters — the human sees the site respond.
 *
 * WITHOUT AN API KEY:
 * Everything still works. `runFallbackAssistant()` is a local, rule-based
 * assistant that uses the same tools. It is obviously less clever, but it
 * means your demo never dies because the wifi did.
 */

import {
  searchListings, getListing, findMatches, getStatistics,
  createListing, createWant, createRequest, getWants, logChat
} from './db.js';
import { CATEGORIES, UNITS, FREQUENCIES } from './seed.js';
import { REGIONS } from './regions.js';

/** Which Claude model to use. Opus 5 is the most capable current model. */
const MODEL = process.env.LOOPNZ_MODEL || 'claude-opus-5';

/**
 * Effort controls how much the model thinks before answering.
 * 'low' = snappiest (good for live demos), 'high' = most thorough.
 * Override with LOOPNZ_EFFORT=high in your .env if you want deeper answers.
 */
const EFFORT = process.env.LOOPNZ_EFFORT || 'medium';

/** Cached SDK client, created lazily on first use. */
let client = null;
let clientLoadAttempted = false;

/**
 * Try to create an Anthropic SDK client.
 * Returns null if the SDK is not installed or there is no API key — in which
 * case the caller falls back to the offline assistant.
 */
async function getClient() {
  if (client) return client;
  if (clientLoadAttempted) return client;
  clientLoadAttempted = true;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[ai] No ANTHROPIC_API_KEY found — running in offline demo mode.');
    return null;
  }
  try {
    // Dynamic import so a missing node_modules folder does not crash the server.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
    console.log(`[ai] Anthropic SDK ready. Model: ${MODEL}, effort: ${EFFORT}`);
    return client;
  } catch (err) {
    console.log('[ai] @anthropic-ai/sdk not installed (run "npm install") — offline demo mode.');
    return null;
  }
}

/** True if the real Claude API is available right now. */
export async function aiAvailable() {
  return (await getClient()) !== null;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

/**
 * The tool schemas handed to Claude.
 *
 * Each description is written prescriptively — it tells Claude *when* to call
 * the tool, not just what it does. That matters: vague descriptions are the
 * number one cause of a model failing to use a tool it should have used.
 */
const TOOLS = [
  {
    name: 'search_listings',
    description:
      'Search the live LoopNZ marketplace for waste material that is currently available. ' +
      'Call this whenever the user asks what is available, mentions a material they want, ' +
      'or describes a project that needs an input material. Returns real listings from the database — ' +
      'never invent listings, always search first. Only returns public listings.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text keywords, e.g. "sawdust" or "shell calcium".' },
        category: { type: 'string', enum: CATEGORIES.map(c => c.id), description: 'Industry category filter.' },
        region: { type: 'string', enum: REGIONS.map(r => r.name), description: 'NZ region to search near.' },
        maxDistanceKm: { type: 'number', description: 'Only include listings within this many km of `region`. Use ~300 for "nearby".' },
        priceType: { type: 'string', enum: ['free', 'paid', 'negotiable', 'pay-to-take'], description: '"pay-to-take" means the producer pays you to remove it.' },
        minTonnes: { type: 'number', description: 'Minimum tonnes available per collection.' },
        maxTonnes: { type: 'number', description: 'Maximum tonnes available per collection.' },
        sort: { type: 'string', enum: ['newest', 'closest', 'largest', 'urgent'], description: 'Result ordering. Use "urgent" for material about to spoil.' },
        limit: { type: 'number', description: 'Max results to return. Default 8.' }
      }
    }
  },
  {
    name: 'find_matches_for_need',
    description:
      'Rank the whole marketplace against a described need and return scored matches with reasons. ' +
      'Use this INSTEAD of search_listings when the user describes a purpose, project or problem rather than ' +
      'naming a specific material — for example "I want to make compostable packaging" or "I need something to ' +
      'lower soil pH". This is also the only way to surface private listings, which are revealed only when the ' +
      'match is genuinely strong.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: "The user's need, purpose or project, in their own words." },
        region: { type: 'string', enum: REGIONS.map(r => r.name), description: 'Where the user is based.' },
        category: { type: 'string', enum: CATEGORIES.map(c => c.id), description: 'Industry category, if known.' },
        tonnesWanted: { type: 'number', description: 'Roughly how many tonnes they need per collection.' }
      },
      required: ['description']
    }
  },
  {
    name: 'get_listing_details',
    description:
      'Fetch the full record for one listing by its id, including contact details, suggested uses, ' +
      'shelf life and pricing. Call this before answering detailed questions about a specific listing.',
    input_schema: {
      type: 'object',
      properties: { listingId: { type: 'string', description: 'The listing id, e.g. "lst_abc123".' } },
      required: ['listingId']
    }
  },
  {
    name: 'get_wanted_posts',
    description:
      'List the people currently looking for waste material. Call this when a user has waste to dispose of ' +
      'and wants to know who might take it, or when they ask "is there demand for X?".',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string', enum: CATEGORIES.map(c => c.id) } }
    }
  },
  {
    name: 'get_statistics',
    description:
      'Get live platform impact statistics: tonnes diverted, CO2e avoided, disposal costs saved, breakdowns by ' +
      'category and region. Call this whenever the user asks about impact, environmental benefit, savings, or ' +
      'how big the problem or the platform is.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'create_listing',
    description:
      'Publish a new waste listing to the marketplace on the user\'s behalf. Only call this once you have ' +
      'confirmed the essentials with them: what the material is, roughly how much and how often, which region, ' +
      'and how perishable it is. Do not guess the quantity or region — ask. After creating, tell them it is live.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        wasteType: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES.map(c => c.id) },
        description: { type: 'string' },
        quantityAmount: { type: 'number' },
        quantityUnit: { type: 'string', enum: UNITS },
        quantityFrequency: { type: 'string', enum: FREQUENCIES },
        region: { type: 'string', enum: REGIONS.map(r => r.name) },
        city: { type: 'string' },
        shelfLifeDays: { type: 'number', description: 'Days before the material spoils or loses value.' },
        priceType: { type: 'string', enum: ['free', 'paid', 'negotiable', 'pay-to-take'] },
        price: { type: 'number', description: 'NZD per tonne. 0 if free.' },
        visibility: { type: 'string', enum: ['public', 'private'], description: 'Private hides it from Browse; the matcher may still reveal it for strong matches.' },
        org: { type: 'string' },
        suggestedUses: { type: 'array', items: { type: 'string' }, description: 'Potential uses you can suggest for this material.' }
      },
      required: ['title', 'category', 'quantityAmount', 'quantityUnit', 'region']
    }
  },
  {
    name: 'create_wanted_post',
    description:
      'Post a public "wanted" request so waste producers can find the user. Use when someone is looking for ' +
      'material that is not currently listed, so they can be notified when it appears.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES.map(c => c.id) },
        region: { type: 'string', enum: REGIONS.map(r => r.name) },
        quantityNeeded: { type: 'string', description: 'Free text, e.g. "5-10 tonnes per month".' },
        org: { type: 'string' }
      },
      required: ['title', 'description']
    }
  },
  {
    name: 'express_interest',
    description:
      'Send an enquiry to the producer of a listing on the user\'s behalf. Confirm with the user before sending, ' +
      'and write a short professional message explaining what they want the material for.',
    input_schema: {
      type: 'object',
      properties: {
        listingId: { type: 'string' },
        message: { type: 'string' },
        fromName: { type: 'string' },
        fromOrg: { type: 'string' }
      },
      required: ['listingId', 'message']
    }
  },

  // ----- UI tools: these drive the website itself ------------------------
  {
    name: 'navigate_to',
    description:
      'Move the user to a different page of the website. Call this to SHOW them what you are talking about ' +
      'rather than only describing it. For example, after finding matches, navigate to "browse" so they can see ' +
      'the results, or to "impact" when discussing statistics. Always still explain in words what you did.',
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: ['home', 'browse', 'match', 'list-waste', 'wanted', 'dashboard', 'impact', 'sdg'],
          description: 'browse = marketplace search, match = swipe-style matching, list-waste = the form for disposing of waste, impact = statistics, sdg = UN Sustainable Development Goals.'
        }
      },
      required: ['page']
    }
  },
  {
    name: 'apply_marketplace_filters',
    description:
      'Set the Browse page filters and run the search in the live UI, so the user sees exactly the results you ' +
      'found. Call this immediately after search_listings when the user would benefit from seeing the results on ' +
      'screen. This navigates to Browse automatically. ' +
      'CRITICAL: pass the SAME arguments you passed to search_listings. In particular, if you set `region` you must ' +
      'also set `maxDistanceKm` — a region on its own means "that exact region only" in the UI, so the user would ' +
      'see zero results for anything you found in a neighbouring region.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES.map(c => c.id) },
        region: { type: 'string', enum: REGIONS.map(r => r.name) },
        maxDistanceKm: { type: 'number' },
        priceType: { type: 'string', enum: ['free', 'paid', 'negotiable', 'pay-to-take'] },
        sort: { type: 'string', enum: ['newest', 'closest', 'largest', 'urgent'] }
      }
    }
  },
  {
    name: 'open_listing',
    description: 'Open the detail panel for one listing in the UI so the user can read it and act on it.',
    input_schema: {
      type: 'object',
      properties: { listingId: { type: 'string' } },
      required: ['listingId']
    }
  },
  {
    name: 'highlight_listings',
    description:
      'Visually highlight specific listings in the UI and show them as a shortlist. Use after find_matches_for_need ' +
      'so the user can see your recommendations picked out from everything else.',
    input_schema: {
      type: 'object',
      properties: {
        listingIds: { type: 'array', items: { type: 'string' } },
        note: { type: 'string', description: 'A one-line caption for the shortlist.' }
      },
      required: ['listingIds']
    }
  },
  {
    name: 'prefill_listing_form',
    description:
      'Fill in the "List your waste" form for the user without submitting it, then take them to that page so they ' +
      'can review and press submit themselves. Prefer this over create_listing when the user seems to want control, ' +
      'or when you are missing a couple of details they can fill in.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        wasteType: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES.map(c => c.id) },
        description: { type: 'string' },
        quantityAmount: { type: 'number' },
        quantityUnit: { type: 'string', enum: UNITS },
        quantityFrequency: { type: 'string', enum: FREQUENCIES },
        region: { type: 'string', enum: REGIONS.map(r => r.name) },
        city: { type: 'string' },
        shelfLifeDays: { type: 'number' },
        priceType: { type: 'string', enum: ['free', 'paid', 'negotiable', 'pay-to-take'] },
        price: { type: 'number' },
        suggestedUses: { type: 'array', items: { type: 'string' } }
      }
    }
  }
];

/** Tool names that are executed by the browser rather than the server. */
const UI_TOOLS = new Set([
  'navigate_to', 'apply_marketplace_filters', 'open_listing',
  'highlight_listings', 'prefill_listing_form'
]);

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

/** Trim a listing down to the fields the model actually needs (saves tokens). */
function summariseListing(l) {
  return {
    id: l.id,
    title: l.title,
    wasteType: l.wasteType,
    category: l.category,
    quantity: `${l.quantity.amount} ${l.quantity.unit} ${l.quantity.frequency}`,
    region: l.region,
    city: l.city,
    distanceKm: l.distanceKm,
    shelfLifeDays: l.shelfLifeDays,
    priceType: l.priceType,
    pricePerTonneNzd: l.price,
    visibility: l.visibility,
    suggestedUses: l.suggestedUses,
    description: (l.description || '').slice(0, 260)
  };
}

/**
 * Run one tool call.
 * Returns { result, action } where `action` (if present) is queued for the
 * browser to execute after the assistant's reply is rendered.
 */
function executeTool(name, input) {
  switch (name) {
    // ----- data tools ----------------------------------------------------
    case 'search_listings': {
      const found = searchListings({ ...input, limit: input.limit || 8 });
      return {
        result: {
          count: found.length,
          listings: found.map(summariseListing),
          note: found.length === 0
            ? 'Nothing matched. Try broadening the query, dropping the region filter, or increasing maxDistanceKm.'
            : undefined
        }
      };
    }

    case 'find_matches_for_need': {
      const matches = findMatches(
        { description: input.description, query: input.description, region: input.region, category: input.category, tonnesWanted: input.tonnesWanted },
        { limit: 6 }
      );
      return {
        result: {
          count: matches.length,
          matches: matches.map(m => ({
            ...summariseListing(m.listing),
            matchScore: m.score,
            whyItMatches: m.reasons,
            isPrivateListing: m.listing.visibility === 'private'
          })),
          note: matches.some(m => m.listing.visibility === 'private')
            ? 'One or more of these are PRIVATE listings, revealed only because the match score is high. Mention that to the user — it is a feature they should know about.'
            : undefined
        }
      };
    }

    case 'get_listing_details': {
      const l = getListing(input.listingId);
      if (!l) return { result: { error: 'No listing with that id.' } };
      return { result: l };
    }

    case 'get_wanted_posts': {
      let wants = getWants();
      if (input.category) wants = wants.filter(w => w.category === input.category);
      return { result: { count: wants.length, wants } };
    }

    case 'get_statistics':
      return { result: getStatistics() };

    case 'create_listing': {
      const created = createListing(input);
      return {
        result: { ok: true, listingId: created.id, title: created.title, message: 'Listing is now live on the marketplace.' },
        action: { type: 'listingCreated', listingId: created.id }
      };
    }

    case 'create_wanted_post': {
      const created = createWant(input);
      return {
        result: { ok: true, wantId: created.id, title: created.title },
        action: { type: 'wantCreated', wantId: created.id }
      };
    }

    case 'express_interest': {
      const req = createRequest({
        listingId: input.listingId,
        message: input.message,
        fromName: input.fromName || 'You',
        fromOrg: input.fromOrg || ''
      });
      if (!req) return { result: { error: 'No listing with that id.' } };
      return {
        result: { ok: true, requestId: req.id, message: 'Enquiry sent to the producer.' },
        action: { type: 'requestSent', requestId: req.id, listingId: input.listingId }
      };
    }

    // ----- UI tools ------------------------------------------------------
    // The server acknowledges them; the browser performs them.
    case 'navigate_to':
      return { result: { ok: true, navigatedTo: input.page }, action: { type: 'navigate', page: input.page } };

    case 'apply_marketplace_filters':
      return { result: { ok: true, filtersApplied: input }, action: { type: 'applyFilters', filters: input } };

    case 'open_listing':
      return { result: { ok: true, opened: input.listingId }, action: { type: 'openListing', listingId: input.listingId } };

    case 'highlight_listings':
      return {
        result: { ok: true, highlighted: input.listingIds.length },
        action: { type: 'highlight', listingIds: input.listingIds, note: input.note || '' }
      };

    case 'prefill_listing_form':
      return { result: { ok: true, formPrefilled: true }, action: { type: 'prefillForm', values: input } };

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * The system prompt. This is the single most important piece of text in the
 * app — it defines who the assistant is and how it should behave.
 * Edit this to change the assistant's personality or priorities.
 */
function buildSystemPrompt(pageContext) {
  const stats = getStatistics();
  return `You are Kōwhai, the AI assistant built into LoopNZ — a New Zealand marketplace that matches primary-industry waste producers with people who can turn that waste into something useful.

WHO YOU HELP
1. Producers with waste to dispose of (packhouses, dairy sheds, sawmills, fisheries, wineries). Help them list it, price it, and find takers.
2. Acquirers who know exactly what material they want. Help them search and enquire.
3. Acquirers who DON'T know what they want — they have a project, a process, or a problem. This is where you add the most value: work out what material would suit, then find it. Ask about their end use, their scale, their location and their processing capability before recommending.

HOW YOU WORK
- You have tools that operate on the real marketplace. Always search or match before naming any listing. Never invent a listing, a quantity, a contact or a statistic.
- You can drive the website. When results would be clearer on screen, call navigate_to, apply_marketplace_filters, highlight_listings or open_listing so the user actually sees what you found. Do this alongside your written answer, not instead of it.
- When you take an action on the site, say so briefly ("I've filtered Browse to Canterbury") so the user understands what just changed.

NEW ZEALAND CONTEXT YOU SHOULD USE
- Freight is the hidden cost. Wet organic waste hauled 500km can emit more than it saves. Always weigh distance, and say so.
- Shelf life is the hardest constraint in primary industry. Kiwifruit pomace is worthless in a week; mussel shell keeps for years. Flag perishability early.
- The NZ waste disposal levy plus gate fees means producers often pay $150-$350 per tonne to landfill material. Reframe waste as an avoided cost, not a giveaway.
- Some listings are private. The matcher reveals them only for strong matches — if that happens, tell the user it is a private listing.

STYLE
- Be direct and practical, like a good broker. Short paragraphs. No filler.
- Lead with the answer, then the reasoning.
- Use specific numbers from the tools: tonnes, kilometres, dollars, days of shelf life.
- Ask at most one clarifying question at a time, and only when the answer would genuinely change your recommendation.
- Never claim environmental impact you have not calculated from the data.

LIVE PLATFORM SNAPSHOT (for context only — call get_statistics for real figures)
${stats.marketplace.activeListings} active listings across ${stats.marketplace.regionsCovered} regions; ${stats.marketplace.urgentListings} of them expire within a week.

The user is currently on the "${pageContext || 'home'}" page.`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Handle one turn of conversation.
 *
 * @param {Array}  history      prior turns: [{role:'user'|'assistant', content:string}]
 * @param {string} userMessage  what the user just typed
 * @param {string} pageContext  which page they are on (helps the AI be relevant)
 * @returns {Promise<{reply:string, actions:Array, toolsUsed:Array, offline:boolean}>}
 */
export async function chat(history, userMessage, pageContext) {
  logChat('user', userMessage);

  const anthropic = await getClient();
  if (!anthropic) {
    const fb = runFallbackAssistant(userMessage, pageContext);
    logChat('assistant', fb.reply);
    return { ...fb, offline: true };
  }

  try {
    const out = await runClaude(anthropic, history, userMessage, pageContext);
    logChat('assistant', out.reply);
    return { ...out, offline: false };
  } catch (err) {
    console.error('[ai] Claude call failed:', err?.message || err);
    // Never let an API failure kill the demo — degrade to the offline brain.
    const fb = runFallbackAssistant(userMessage, pageContext);
    fb.reply = `_(Claude is unavailable right now — ${err?.message || 'network error'}. Falling back to the built-in assistant.)_\n\n` + fb.reply;
    logChat('assistant', fb.reply);
    return { ...fb, offline: true };
  }
}

/**
 * The real Claude call, including the agentic tool loop:
 *   ask Claude -> it requests tools -> we run them -> feed results back -> repeat
 * until it stops asking for tools and produces a final answer.
 */
async function runClaude(anthropic, history, userMessage, pageContext) {
  // Rebuild the message list. We only keep the last 12 turns to control cost.
  const messages = history
    .slice(-12)
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));

  messages.push({ role: 'user', content: userMessage });

  const actions = [];
  const toolsUsed = [];
  const MAX_ITERATIONS = 6; // safety valve so a confused model cannot loop forever

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(pageContext),
          // Cache the system prompt + tool definitions: they are identical on
          // every request, so we only pay full price for them once.
          cache_control: { type: 'ephemeral' }
        }
      ],
      output_config: { effort: EFFORT },
      tools: TOOLS,
      messages
    });

    // Claude has finished when it stops asking for tools.
    if (response.stop_reason !== 'tool_use') {
      // Safety classifiers can decline a request — handle it rather than
      // reading content[0] and crashing on an empty array.
      if (response.stop_reason === 'refusal') {
        return { reply: "I can't help with that particular request, but I'm happy to help you find or list waste material.", actions, toolsUsed };
      }
      const reply = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      return { reply: reply || 'Done.', actions, toolsUsed };
    }

    // Echo the assistant's turn back (required — it contains the tool_use blocks)
    messages.push({ role: 'assistant', content: response.content });

    // Run every tool Claude asked for, and collect the results into ONE user
    // message (splitting them teaches the model to stop calling tools in parallel).
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      toolsUsed.push(block.name);
      let outcome;
      try {
        outcome = executeTool(block.name, block.input || {});
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

// ---------------------------------------------------------------------------
// Offline fallback assistant
// ---------------------------------------------------------------------------

/**
 * A deterministic, keyword-driven assistant that runs entirely locally.
 *
 * It uses the SAME tools as Claude, so it can still search the marketplace,
 * apply filters and navigate the site — just with hand-written intent detection
 * instead of a language model. This guarantees the demo works offline.
 */
export function runFallbackAssistant(message, pageContext) {
  const text = (message || '').toLowerCase();
  const actions = [];
  const toolsUsed = [];

  const mentions = (...words) => words.some(w => text.includes(w));

  // Try to spot a NZ region name in the message.
  const region = REGIONS.find(r => text.includes(r.name.toLowerCase()))?.name
    || (text.includes('christchurch') ? 'Canterbury'
      : text.includes('auckland') ? 'Auckland'
        : text.includes('wellington') ? 'Wellington'
          : text.includes('dunedin') ? 'Otago'
            : text.includes('tauranga') ? 'Bay of Plenty'
              : text.includes('hamilton') ? 'Waikato'
                : text.includes('nelson') ? 'Nelson' : null);

  // ----- intent: statistics ------------------------------------------------
  if (mentions('impact', 'statistic', 'co2', 'carbon', 'emission', 'saving', 'saved', 'how much waste')) {
    const s = getStatistics();
    toolsUsed.push('get_statistics');
    actions.push({ type: 'navigate', page: 'impact' });
    return {
      reply:
        `Here is where LoopNZ stands right now.\n\n` +
        `**Already realised** — ${s.realised.tonnesDiverted.toLocaleString()} tonnes diverted from landfill across ${s.realised.dealsCompleted} completed matches, avoiding about ${s.realised.co2AvoidedTonnes.toLocaleString()} tonnes of CO₂e and saving producers roughly $${s.realised.moneySavedNzd.toLocaleString()} in disposal costs.\n\n` +
        `**Currently listed** — if everything on the marketplace today found a taker, that is ${s.potential.tonnesPerYear.toLocaleString()} tonnes a year, about ${s.potential.co2AvoidedTonnesPerYear.toLocaleString()} tonnes of CO₂e — the same as taking roughly ${s.equivalents.carsOffRoadPerYear.toLocaleString()} cars off New Zealand roads.\n\n` +
        `I've opened the Impact page so you can see the breakdown by industry and region.`,
      actions, toolsUsed
    };
  }

  // ----- intent: UN goals --------------------------------------------------
  if (mentions('sdg', 'sustainable development', 'un goal', 'united nations')) {
    actions.push({ type: 'navigate', page: 'sdg' });
    return {
      reply:
        `LoopNZ maps most directly onto **SDG 12 (Responsible Consumption and Production)** — specifically target 12.3 on food loss and 12.5 on waste reduction through reuse.\n\n` +
        `It also contributes to **SDG 13 (Climate Action)** by avoiding landfill methane, **SDG 9 (Industry, Innovation and Infrastructure)** by creating industrial symbiosis between sectors, and **SDG 8 (Decent Work and Economic Growth)** by turning a disposal cost into a revenue stream for rural businesses.\n\n` +
        `I've opened the UN Goals page with the full mapping.`,
      actions, toolsUsed
    };
  }

  // ----- intent: dispose of waste -----------------------------------------
  if (mentions('i have', 'dispose', 'get rid of', 'list my', 'we produce', 'our waste', 'sell my')) {
    actions.push({ type: 'navigate', page: 'list-waste' });
    toolsUsed.push('get_wanted_posts');
    const wants = getWants().slice(0, 3);
    return {
      reply:
        `Let's get it listed. I've opened the "List your waste" form for you.\n\n` +
        `The four things that matter most are: **what the material is**, **how much and how often**, **which region** it's in, and **how long before it spoils**. Shelf life is the field people skip and it's the one that decides whether anyone can realistically collect it.\n\n` +
        `For context, here are three people actively looking right now:\n` +
        wants.map(w => `- **${w.org}** (${w.region}) — ${w.title}`).join('\n') +
        `\n\nIf you tell me what the material is and roughly how much, I can suggest uses and a fair price type.`,
      actions, toolsUsed
    };
  }

  // ----- intent: not sure what they need -----------------------------------
  if (mentions("don't know", 'not sure', 'unsure', 'suggest', 'what could i', 'ideas', 'help me find something')) {
    const matches = findMatches({ description: message, region }, { limit: 4 });
    toolsUsed.push('find_matches_for_need');
    if (matches.length) {
      actions.push({ type: 'highlight', listingIds: matches.map(m => m.listing.id), note: 'Suggested for your project' });
      actions.push({ type: 'navigate', page: 'browse' });
    }
    return {
      reply:
        `No problem — that's the most interesting case to work on.\n\n` +
        `Tell me three things and I can narrow it fast: **what you're trying to make or do**, **roughly what scale** (kilograms a month, or tonnes a week?), and **where you're based**.\n\n` +
        (matches.length
          ? `In the meantime, based on what you've said these look closest:\n\n` +
            matches.map(m => `- **${m.listing.title}** (${m.listing.region}) — ${m.score}% match. ${m.reasons[0] || ''}`).join('\n')
          : `Even a rough description helps — for example "I want to make garden products" or "I need a calcium source".`),
      actions, toolsUsed
    };
  }

  // ----- intent: search ----------------------------------------------------
  // Pull out likely material keywords from the message.
  const stop = new Set(['what', 'have', 'looking', 'want', 'need', 'find', 'show', 'give', 'some', 'near', 'from', 'that', 'with', 'about', 'there', 'this', 'anything', 'available', 'could', 'would', 'please', 'material', 'waste']);
  const keywords = text.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w));

  let results = keywords.length
    ? searchListings({ query: keywords.slice(0, 2).join(' '), region, maxDistanceKm: region ? 600 : undefined, limit: 5 })
    : [];

  // If a two-word search found nothing, retry with just the strongest keyword.
  if (!results.length && keywords.length) {
    results = searchListings({ query: keywords[0], region, maxDistanceKm: region ? 900 : undefined, limit: 5 });
  }
  // Still nothing? Fall back to a scored match against the raw sentence.
  if (!results.length) {
    const m = findMatches({ description: message, region }, { limit: 5, minScore: 20 });
    results = m.map(x => ({ ...x.listing, distanceKm: x.distanceKm, _score: x.score }));
    toolsUsed.push('find_matches_for_need');
  } else {
    toolsUsed.push('search_listings');
  }

  if (results.length) {
    // IMPORTANT: mirror the SAME distance radius we searched with. Setting a
    // region without a radius means "that region only" in the UI, which would
    // show zero results for anything we found in a neighbouring region.
    actions.push({
      type: 'applyFilters',
      filters: {
        query: keywords.slice(0, 2).join(' '),
        region: region || '',
        maxDistanceKm: region ? 1000 : undefined,
        sort: region ? 'closest' : 'newest'
      }
    });
    actions.push({ type: 'highlight', listingIds: results.map(r => r.id), note: 'Found for you' });
    return {
      reply:
        `Found ${results.length} listing${results.length > 1 ? 's' : ''}${region ? ` near ${region}` : ''}:\n\n` +
        results.map(r =>
          `- **${r.title}** — ${r.quantity.amount} ${r.quantity.unit} ${r.quantity.frequency}, ${r.city || r.region}` +
          (r.distanceKm != null ? ` (${r.distanceKm} km away)` : '') +
          `. ${r.priceType === 'pay-to-take' ? `Producer pays $${r.price}/t to have it removed.` : r.priceType === 'free' ? 'Free to collect.' : `$${r.price}/t, ${r.priceType}.`}` +
          ` Shelf life ${r.shelfLifeDays} days.`
        ).join('\n') +
        `\n\nI've applied those filters on the Browse page. Click any card for contact details and suggested uses.`,
      actions, toolsUsed
    };
  }

  // ----- fallback: explain what I can do -----------------------------------
  return {
    reply:
      `I couldn't find a direct match for that. I can help three ways:\n\n` +
      `1. **You have waste** — tell me what it is and I'll help you list it.\n` +
      `2. **You know what you want** — name the material and a region and I'll search.\n` +
      `3. **You're not sure** — describe your project and I'll work out which waste stream suits.\n\n` +
      `Try something like "I need a calcium source near Christchurch" or "what can I do with sawdust?".`,
    actions, toolsUsed
  };
}

/** Exported for the /api/meta endpoint so the UI can show AI status. */
export const AI_CONFIG = { model: MODEL, effort: EFFORT };
