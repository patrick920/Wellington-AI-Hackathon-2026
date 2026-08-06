# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LoopNZ — a local-only web app for AI Hackathon 2026. A marketplace matching New Zealand
primary-industry waste producers with people who can reuse the material, with an AI
assistant that can operate the website itself. See `README.md` for the product description
and demo script.

## Commands

```bash
npm start            # serve on http://localhost:3000 — needs NO npm install
npm run dev          # same, with node --watch (server restarts on file change)
npm run check-ai     # diagnose the AI provider: key, model list, live tool-loop test
npm install          # optional — only the Claude provider needs the Anthropic SDK
```

There is **no test suite, no linter, and no build step**. To check work:

```bash
node --check <file>                      # syntax-check any JS file
curl -s localhost:3000/api/meta          # shows the active AI provider
curl -s localhost:3000/api/stats         # smoke-test an endpoint
curl -s -X POST localhost:3000/api/reset # wipe and re-seed the demo data
```

`npm run check-ai` is the fastest way to diagnose anything AI-related — it prints which
providers have keys, which one would be selected and why, the model names the key can
actually reach, and then runs one real message through the tool loop.

Deleting `data/db.json` also resets to seed data on next start. `data/db.json` and `.env`
are gitignored.

**After editing anything in `public/`, a hard reload (`Ctrl+Shift+R`) is required.** The
server sends `Cache-Control: no-cache`, but a plain reload will still serve stale ES
modules. This has caused confusing "my fix didn't work" debugging before.

## Architecture

### Zero-build, zero-framework by design

Front end is ES modules loaded directly by the browser via `<script type="module">`. There
is no React, no bundler, no JSX. UI is built with the `h(tag, attrs, ...children)` helper in
`public/js/utils.js`. Keep it that way — the whole point is that any file can be opened and
read without tooling.

### Provider architecture

`server/ai.js` owns everything that is identical across AI backends: the `TOOLS` array,
`executeTool()`, `buildSystemPrompt()`, and the offline fallback. Backend-specific code
lives in `server/providers/`, one file each, all exposing the same contract:

```
isConfigured()  describe()  model()  runTurn({system, tools, history, userMessage, runTool, maxIterations})
                                       -> { reply, actions, toolsUsed }
```

`runTurn()` owns the whole agentic loop for that backend and calls `runTool` (which is
`executeTool`) for each requested tool. Adding a provider is one new file plus an entry in
the `PROVIDERS` array — nothing else in the app changes.

**Gemini is the default and deliberately has zero dependencies** — it uses raw `fetch`
against the REST API, so the whole app runs from `node server/server.js` with no install.
Claude is opt-in and uses the official SDK, dynamically imported so a missing
`node_modules` degrades instead of crashing.

Selection order (`pickProvider()`): explicit `LOOPNZ_PROVIDER`, else the first provider in
`PROVIDERS` with a key, else offline. The result is cached in module scope for the process
lifetime.

### The dual-path AI invariant

`runFallbackAssistant()` in `ai.js` is a local keyword-driven assistant using the **same
tools**. It runs when no provider is configured **and** whenever a provider call throws —
so a live demo survives a dead key, a wrong model name, a rate limit, or no wifi. The
thrown error is surfaced in the reply text rather than swallowed, which is what makes
provider misconfiguration debuggable.

When adding an assistant capability, consider whether the fallback needs a matching branch
— a feature that only works with a key will silently vanish in offline mode.

### How the AI drives the website

This is the core mechanism and it spans three files.

`server/ai.js` defines a `TOOLS` array. The `UI_TOOLS` set marks which of those are
executed by the *browser* rather than the server. `executeTool()` returns
`{ result, action? }`:

- **Data tools** return only `result` — they read/write `db.js` directly.
- **UI tools** return an `action` object, which is collected into an `actions[]` array and
  returned alongside the reply from `POST /api/chat`.

`runActions()` in `public/js/chat.js` then executes those actions against the live UI
(navigate, set filters, open the drawer, highlight listings, prefill the form).

**Adding a UI tool requires edits in three places:** the `TOOLS` array, the `UI_TOOLS` set
and `executeTool()` in `server/ai.js`, plus a `case` in `runActions()` in `chat.js`.

**Adding a page requires four:** a module in `public/js/pages/` exporting
`{ render(container) }`, a `registerRoute()` call in `app.js`, a nav link in `index.html`,
and the page name added to the `navigate_to` tool's enum in `ai.js` (otherwise the AI cannot
reach it).

### One search implementation, two callers

`searchListings()` in `server/db.js` backs both the Browse page and the AI's
`search_listings` tool. Do not fork it — the product claim is that the AI and the human see
exactly the same marketplace. Same for `findMatches()` / `scoreMatch()`.

### Rendering and state

`public/js/state.js` is a plain mutable object plus a `subscribe()` list. **`setState()`
does not trigger a re-render.** Nothing observes state changes; a page repaints only when
the router calls `page.render(container)`.

Consequences worth knowing:

- To make a state change visible, call `navigate(...)` after `setState(...)`.
- `navigate()` in `router.js` detects when the target hash equals the current one and calls
  `renderCurrent()` directly, because setting `location.hash` to its existing value fires no
  `hashchange`. Without this, the AI applying filters while the user is already on Browse
  would do nothing.
- `renderCurrent()` sets `history.scrollRestoration = 'manual'` and temporarily overrides
  `scroll-behavior: smooth` before `scrollTo(0,0)`. Both are required: pages render
  asynchronously, so browser scroll restoration and an in-flight smooth scroll both land
  *after* the new content and strand the user mid-page.
- `listWaste.js` clears `state.prefill` by direct assignment rather than `setState`, to
  avoid a redundant render during its own render pass.

### CSS custom properties in JS

`el.style['--pct'] = x` silently does nothing. The `h()` helper detects `--` prefixed
properties and routes them through `setProperty`. Match-score rings depend on this.

### Data layer

`server/db.js` is a JSON file "database" (`data/db.json`), loaded into memory and written
back on every mutation. Single-process only; there is no locking. It is deliberately easy to
swap for SQLite — nothing outside `db.js` touches the file.

`server/seed.js` holds the seed dataset and the field guide for a listing (read the comment
block at the top before adding one). It also exports `CATEGORIES`, `UNITS`, `FREQUENCIES`,
`UNIT_TO_TONNES` and `FREQUENCY_PER_YEAR`.

**Known duplication to keep in sync:** the unit→tonnes and frequency→per-year conversion
tables appear in three places — `server/seed.js` (authoritative), plus local copies in
`public/js/components.js` (`estimateAnnualTonnes`) and `public/js/pages/listWaste.js`
(the live impact preview). The copies exist so the browser can recalculate without a round
trip. Change one, change all three.

### Matching engine

`scoreMatch()` in `db.js` scores a listing 0–100 and returns human-readable `reasons`,
which the UI displays verbatim. Three behaviours that look like bugs but are deliberate:

- **Stemming** (`stemWord`) strips common suffixes so "starchy" matches "starch".
- **`STOPWORDS`** filters generic words. "natural" is in there on purpose — it appeared in
  so many listings it drowned out the words carrying actual intent.
- **The relevance gate.** Proximity, shelf life, volume and cost are accumulated into
  `logistics`, then multiplied by `0.45 + 0.55 * relevance`. Without it, anything nearby and
  long-lived outranked genuinely suitable material in another region.

Distances come from regional centroids in `server/regions.js`, so a listing in the user's own
region measures **0 km**. Both `components.js` and `match.js` special-case this to avoid
rendering "0 km away".

### Privacy model

`visibility: 'private'` listings are excluded from `searchListings()` unless
`includePrivate` is set, and `findMatches()` reveals them **only at score ≥ 60**. This is a
product feature from the planning document, not an accident — the mānuka listing in the seed
data exists to demonstrate it.

### Statistics

`getStatistics()` deliberately separates `realised` (completed deals) from `potential`
(annualised value of live listings). Do not merge them; the Impact page's methodology
section explains the distinction and the honesty claim depends on it.

## Provider specifics

Shared by both: the tool loop is capped at 6 iterations, and **all tool results for one
assistant turn go back in a single message** — splitting them trains models out of parallel
tool calls.

### Gemini (`providers/gemini.js`, default)

The whole file is essentially a translation layer from LoopNZ's Anthropic-style tool
definitions to Gemini's format. Three traps encoded there:

- **Schema dialect.** Gemini accepts only a subset of JSON Schema. `toGeminiSchema()`
  whitelists keys via `ALLOWED_SCHEMA_KEYS`; anything else (notably `additionalProperties`)
  causes a 400 for the *whole request*. A sudden 400 after editing a tool schema starts here.
- **Empty parameters.** A tool with no arguments must omit `parameters` entirely —
  `{type:'object', properties:{}}` is rejected. `get_statistics` is the one that hits this.
- **Message shape.** The assistant role is `model`, tool calls are `functionCall` parts, and
  results go back as `functionResponse` parts in a **`user`** turn whose `response` value
  must be a JSON object (`asResponseObject()` guards this).

Model names change over time; `listModels()` powers `npm run check-ai` so a wrong
`LOOPNZ_GEMINI_MODEL` can be fixed without guessing. `friendlyError()` maps HTTP statuses
to actionable messages — extend it rather than letting raw JSON reach the user.

### Claude (`providers/claude.js`, opt-in)

- Thinking is on by default on Opus 5, so the `thinking` parameter is intentionally omitted.
  Depth is `output_config: { effort }` (`LOOPNZ_EFFORT`).
- The system block carries `cache_control: { type: 'ephemeral' }`. Keep the system prompt
  and `TOOLS` byte-stable across requests or caching stops working.
- `stop_reason === 'refusal'` is handled before reading `response.content`, which can be
  empty on a refusal.

## Environment

`.env` is parsed by a hand-rolled reader in `server/server.js` (`loadEnvFile`) — supports
`KEY=value` and `#` comments only, and `check-ai.js` duplicates it so the diagnostic can run
standalone. Copy from `.env.example`.

Keys: `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), `LOOPNZ_GEMINI_MODEL`, `ANTHROPIC_API_KEY`,
`LOOPNZ_CLAUDE_MODEL`, `LOOPNZ_EFFORT`, `LOOPNZ_PROVIDER`, `PORT`.

**A recurring support issue: people edit `.env.example` instead of `.env`.** Only `.env` is
read. Check this first when someone reports "my key isn't working".

## Conventions

Every file opens with a comment block explaining what it is for and why it is built that
way, and inline comments explain non-obvious decisions. The user is a hackathon participant
who needs to read and modify this code — match that density when adding files.
