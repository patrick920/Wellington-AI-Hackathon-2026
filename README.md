# ♻ LoopNZ

**An AI-powered marketplace that matches New Zealand primary-industry waste producers with the people who can turn that waste into something useful.**

Built for **AI Hackathon 2026**. Runs entirely on your own machine — nothing is deployed to the internet.

---

## Quick start

### Windows
Double-click **`start.bat`**.

### macOS / Linux
```bash
chmod +x start.sh     # first time only
./start.sh
```

### Any platform, manually
```bash
node server/server.js     # no npm install required
```

Then open **http://localhost:3000**

> **You do not need an API key or `npm install` to run it.** The default AI provider
> (Google Gemini) talks to a REST API with plain `fetch`, so the app runs with zero
> dependencies. Without a key, the chatbot falls back to a built-in offline assistant that
> can still search the marketplace, apply filters and navigate the site.
> See [Enabling the AI](#enabling-the-ai) for the free key.

---

## The problem we're solving

New Zealand's primary industries throw away millions of tonnes of usable material every
year. A kiwifruit packhouse in Te Puke pays roughly $195 a tonne to landfill skin and
pomace that is rich in pectin and actinidin enzyme. Two hours away, a pectin start-up is
buying imported raw material.

Neither knows the other exists.

That is not a technology problem — the pectin chemistry, the anaerobic digesters and the
shell crushers all already exist in New Zealand. It is an **information and matching**
problem. And matching is exactly what AI is good at.

---

## What's in the app

| Page | What it does |
|---|---|
| **Home** | The pitch: the problem, live numbers, and three ways in (one per user type) |
| **Browse** | Marketplace search — filter by material, industry, region, distance, price type, urgency |
| **Match** | The dating-app half. Describe your *goal*, not the material; swipe through scored matches with a "why this matched" explanation on every card |
| **List waste** | The producer form, with a live impact preview and privacy controls |
| **Wanted** | Reverse marketplace — people advertising what they need, so producers can see demand |
| **Impact** | Statistics: tonnes diverted, CO₂e avoided, disposal cost saved, broken down by industry and region, with the methodology written out |
| **UN Goals** | Which Sustainable Development Goals this addresses, down to the specific target numbers, with live metrics |
| **Dashboard** | Your listings, shortlist, and enquiries. Accepting an enquiry records a real diversion, which feeds the Impact page |

Plus **Kōwhai**, the AI assistant, available on every page.

---

## The bit that makes this different: the AI can drive the website

Most AI features in hackathon projects are a chat box bolted to the side of an app. This
one is wired into the product.

Kōwhai has **thirteen tools**, split into two kinds:

**Data tools** run on the server against the real database. The AI genuinely searches the
listings, reads the real statistics, and creates real records. It cannot invent a listing.

- `search_listings` · `find_matches_for_need` · `get_listing_details`
- `get_wanted_posts` · `get_statistics`
- `create_listing` · `create_wanted_post` · `express_interest`

**UI tools** are executed by your browser. This is how the AI changes what you are looking at.

- `navigate_to` — moves you to a different page
- `apply_marketplace_filters` — sets the Browse filters and runs the search
- `open_listing` — opens the detail drawer
- `highlight_listings` — marks its recommendations with an "AI pick" badge
- `prefill_listing_form` — fills in the listing form for you to review

So when you type *"I need untreated sawdust near Auckland for a mushroom farm"*, the AI
searches the real marketplace, then **actually navigates to Browse, actually sets the
filters, and actually highlights what it found.** The chat panel shows a strip along the
bottom saying what it just changed, and small chips under each reply showing which tools
it used — worth pointing at during the pitch.

### Things worth demoing

| Say this | What happens |
|---|---|
| *"I run a kiwifruit packhouse in Te Puke and throw out 40 tonnes of skin a week"* | Opens the listing form, suggests uses, offers to fill it in |
| *"I need a calcium source near Christchurch to lift soil pH"* | Searches, filters Browse to the South Island, highlights mussel and oyster shell |
| *"I want to start a skincare brand in Northland but don't know what to use"* | Asks about the end use, then finds the mānuka leaf residue — which is a **private listing**, revealed only because the match score is high enough |
| *"What's the total environmental impact of everything listed?"* | Reads live statistics and opens the Impact page |

---

## Enabling the AI

The default provider is **Google Gemini**, because AI Studio gives out a free API key with
no credit card required.

1. Get a free key from <https://aistudio.google.com/apikey>
2. Copy `.env.example` to `.env`
   - Windows: `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
3. Paste your key in:
   ```
   GEMINI_API_KEY=your-key-here
   ```
4. Restart the server, then confirm it works:
   ```bash
   npm run check-ai
   ```

`check-ai` reports which provider is active, lists the model names your key can actually
use, and sends one real message through the full tool loop — so you find out about a
problem there rather than during your pitch.

The badge in the top-right corner shows which brain is answering: **GEMINI** or **CLAUDE**
(green) when a provider is live, **DEMO AI** (amber) for the offline assistant.

### Using Claude instead

Claude is fully supported as an alternative, but the Anthropic API is **paid** — a
Claude.ai Pro/Max subscription does *not* include API credits. If you have credits:

```bash
npm install                       # the Claude provider needs the Anthropic SDK
```
```
ANTHROPIC_API_KEY=sk-ant-...
LOOPNZ_PROVIDER=claude            # only needed if a Gemini key is also present
```

### Configuration

All optional, all in `.env`:

| Setting | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | *(none)* | Free key from AI Studio. Also accepts `GOOGLE_API_KEY` |
| `LOOPNZ_GEMINI_MODEL` | `gemini-2.5-flash` | Try `gemini-2.5-pro` for more capability. Run `npm run check-ai` to see valid names |
| `ANTHROPIC_API_KEY` | *(none)* | Paid. Only needed for the Claude provider |
| `LOOPNZ_CLAUDE_MODEL` | `claude-sonnet-5` | `claude-opus-5` is more capable, ~2.5× the cost |
| `LOOPNZ_EFFORT` | `medium` | Claude only. `low` for snappier demo replies |
| `LOOPNZ_PROVIDER` | *(auto)* | Force one: `gemini`, `claude`, or `offline` |
| `PORT` | `3000` | Change if 3000 is taken |

With no `LOOPNZ_PROVIDER` set, LoopNZ picks the first provider that has a key: Gemini,
then Claude, then the offline assistant.

### Adding another provider

Each provider is one file in `server/providers/` exposing the same small contract
(`isConfigured`, `describe`, `model`, `runTurn`). The tool definitions, the code that
executes them, the system prompt and the entire front end are shared and never change —
a new provider only has to translate the tool schema and the message shapes. See the
comment block at the top of `server/providers/gemini.js`, which does exactly that
translation for Gemini's `functionDeclarations` format.

---

## How the matching engine works

Every listing is scored out of 100 against a stated need. The score is deliberately
explainable — the UI shows the reasons, so a farmer can argue with it.

| Factor | Max | Why it's weighted that way |
|---|---:|---|
| **Keyword relevance** | 45 | Does the material actually suit the purpose? Searched across the title, the suggested uses, and the description, with the first two weighted higher |
| **Category match** | 8 | Same industry is a strong signal on its own |
| **Proximity** | 25 | Trucking wet organic waste 800 km cancels out the climate benefit |
| **Shelf life** | 15 | Can the taker realistically get there before it spoils? |
| **Volume fit** | 10 | Matching a 1-tonne need to a 400-tonne pile is noise |
| **Cost** | 5 | Free, or paid-to-take, is a genuine bonus |

Three details worth knowing:

- **Crude stemming.** "starchy" matches "starch", "shells" matches "shell". Without this, a
  lot of obvious matches were being missed on word endings alone.
- **Stopwords.** Generic words ("natural", "material", "looking") were matching half the
  marketplace and drowning out the words that carry actual intent.
- **The relevance gate.** Proximity, shelf life and volume are *logistics* — they tell you
  whether collection is practical, not whether the material is right. A listing that matched
  none of your words keeps only 45% of its logistics score. Without this, anything nearby
  and long-lived outranked the genuinely useful material two regions over.

### Private listings

A producer can mark a listing **private**. It is then hidden from Browse entirely, but the
AI matcher can still surface it — **only** when the match scores 60 or above. This is the
privacy model from the planning document: you don't have to advertise your volumes to your
competitors to still find the one buyer who genuinely needs your material.

---

## Project structure

```
├── start.bat / start.sh      One-click launchers
├── .env.example              Copy to .env and add your API key
├── package.json              No required dependencies (Anthropic SDK is optional)
│
├── server/
│   ├── server.js             HTTP server, static files, JSON API
│   ├── db.js                 JSON-file database + search + the matching engine
│   ├── ai.js                 Tool definitions, provider selection, offline fallback
│   ├── providers/
│   │   ├── gemini.js         Google Gemini — the default, zero dependencies
│   │   └── claude.js         Anthropic Claude — opt-in, uses the official SDK
│   ├── check-ai.js           `npm run check-ai` diagnostic
│   ├── seed.js               28 realistic NZ waste streams + wanted posts + past deals
│   └── regions.js            NZ regions with coordinates, distance maths
│
├── public/
│   ├── index.html            App shell
│   ├── css/styles.css        All styling (design tokens at the top)
│   └── js/
│       ├── app.js            Entry point — start reading here
│       ├── router.js         Hash-based page router
│       ├── state.js          Shared application state
│       ├── api.js            Every call to the server, in one file
│       ├── chat.js           Chat panel + THE ACTION EXECUTOR
│       ├── components.js     Listing cards, badges, detail drawer
│       ├── utils.js          DOM builder + formatting helpers
│       └── pages/            One file per page
│
└── data/db.json              Created on first run. Delete it to reset.
```

**Every file is commented.** If you're modifying something, start with the comment block at
the top of the file — it explains what that file is for and why it's built that way.

---

## Common tasks

**Add a waste listing to the seed data**
Copy any object in `server/seed.js` → `SEED_LISTINGS`, change the fields, then delete
`data/db.json` and restart. The field guide is in the comment at the top of that file.

**Change the AI's personality or priorities**
Edit `buildSystemPrompt()` in `server/ai.js`. That single string is the most important text
in the app.

**Give the AI a new ability**
1. Add a tool definition to the `TOOLS` array in `server/ai.js`
2. Add a `case` for it in `executeTool()`
3. If it changes the UI, add its name to `UI_TOOLS` and add a matching `case` to
   `runActions()` in `public/js/chat.js`

**Add a page**
1. Create `public/js/pages/yourPage.js` exporting `{ render(container) }`
2. Register it in `public/js/app.js`
3. Add a nav link in `public/index.html`
4. Add the page name to the `navigate_to` tool's enum in `server/ai.js` so the AI can go there

**Re-skin the site**
Everything is CSS custom properties. Change the values in the `:root` block at the top of
`public/css/styles.css`. Dark mode is a second block just below it.

**Reset the demo between practice runs**
Click **Reset demo data** in the footer, or delete `data/db.json` and restart.

---

## Notes on the numbers

The impact figures are **realistic order-of-magnitude estimates for a demo, not audited
data.** Be upfront about this if a judge asks — it's a stronger answer than pretending
otherwise. The Impact page has a "How these numbers are calculated" section that spells out
every assumption.

The page deliberately separates two things that sustainability dashboards usually blur:

- **Realised** — from matches actually completed on the platform.
- **Potential** — what the currently listed material *would* achieve if it all found a
  taker. This will never be fully true; it's a measure of the opportunity, not an outcome.

---

## UN Sustainable Development Goals

Directly addressed: **12** (Responsible Consumption and Production), **13** (Climate
Action), **9** (Industry, Innovation and Infrastructure), **8** (Decent Work and Economic
Growth).

Also contributed to: **2**, **6**, **11**, **14**, **15**, **17**.

The in-app UN Goals page names the specific targets (12.3, 12.5, 13.2, 9.4 …) and pulls
live figures from the marketplace.

---

## Troubleshooting

**"Cannot reach the server"**
The server isn't running. Run `npm start` and reload the page.

**Port 3000 already in use**
Set `PORT=3001` in `.env`, or stop whatever else is using it.

**Chat says "offline demo assistant"**
No API key found. Run `npm run check-ai` — it will tell you exactly what's missing. The
most common cause is editing `.env.example` instead of `.env`; the app only reads `.env`.

**"Gemini model ... was not found"**
Model names change over time. Run `npm run check-ai` to list the ones your key can use,
then set `LOOPNZ_GEMINI_MODEL` in `.env` to one of them.

**"Gemini rejected the request (400)"**
Usually a tool-schema problem — Gemini accepts only a subset of JSON Schema. See
`toGeminiSchema()` in `server/providers/gemini.js`.

**Gemini rate limit (429)**
The free tier has per-minute limits. Wait a minute, or slow the demo down.

**Changes to a JS or CSS file aren't showing up**
Hard-reload the browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac).

**Something looks broken after experimenting**
Delete `data/db.json` and restart. That restores the original seed data.

---

Built with Node.js and vanilla HTML/CSS/JavaScript, on the Google Gemini API (with
Anthropic Claude as an alternative). No build step, no bundler, no framework — open any
file and read it.
