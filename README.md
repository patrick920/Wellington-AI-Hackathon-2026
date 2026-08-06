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
npm install           # installs one dependency: the Anthropic SDK
npm start
```

Then open **http://localhost:3000**

> **You do not need an API key to run it.** Without one, the chatbot falls back to a
> built-in offline assistant that can still search the marketplace, apply filters and
> navigate the site. To get the real Claude experience, see [Enabling the AI](#enabling-the-ai).

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

1. Get a key from <https://console.anthropic.com/settings/keys>
2. Copy `.env.example` to `.env`
3. Paste your key in:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Restart the server.

The badge in the top-right corner tells you which mode you're in — **AI LIVE** (green) or
**DEMO AI** (amber).

### Configuration

All optional, all in `.env`:

| Setting | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(none)* | Without it, the offline assistant is used |
| `LOOPNZ_MODEL` | `claude-opus-5` | Use `claude-sonnet-5` for lower cost |
| `LOOPNZ_EFFORT` | `medium` | `low` for snappier demo replies, `high` for more thorough answers |
| `PORT` | `3000` | Change if 3000 is taken |

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
├── package.json              One dependency: @anthropic-ai/sdk
│
├── server/
│   ├── server.js             HTTP server, static files, JSON API
│   ├── db.js                 JSON-file database + search + the matching engine
│   ├── ai.js                 Claude integration, tool definitions, offline fallback
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
No `ANTHROPIC_API_KEY` in `.env`, or `npm install` hasn't been run. Both are fine — the app
still works.

**Changes to a JS or CSS file aren't showing up**
Hard-reload the browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac).

**Something looks broken after experimenting**
Delete `data/db.json` and restart. That restores the original seed data.

---

Built with Node.js, vanilla HTML/CSS/JavaScript, and the Claude API. No build step, no
bundler, no framework — open any file and read it.
