/**
 * pages/home.js
 * -------------
 * The landing page. Its job in a 5-minute pitch is to state the problem, show
 * that the marketplace is real, and give three obvious ways in — one per user
 * type from the planning document.
 */

import { h, render, num, tonnes, money, loadingBlock } from '../utils.js';
import { api } from '../api.js';
import { state, setState } from '../state.js';
import { navigate } from '../router.js';
import { sendMessage } from '../chat.js';
import { listingCard } from '../components.js';
import { heroScene, stepArt, categoryArt } from '../illustrations.js';

export const homePage = {
  async render(container) {
    render(container, loadingBlock('Loading marketplace…'));

    // Fetch everything the page needs in parallel — faster than one at a time.
    const [stats, latest, urgent] = await Promise.all([
      api.stats(),
      api.listings({ sort: 'newest' }),
      api.listings({ sort: 'urgent' })
    ]);

    render(container,
      heroSection(stats),
      h('div', { class: 'page' },
        problemSection(stats),
        howItWorksSection(),
        urgentSection(urgent.listings.slice(0, 3)),
        categoriesSection(stats),
        latestSection(latest.listings.slice(0, 6)),
        ctaSection()
      )
    );
  }
};

// ---------------------------------------------------------------------------

function heroSection(stats) {
  const input = h('input', {
    type: 'text',
    placeholder: 'e.g. "I need a cheap calcium source near Timaru"',
    'aria-label': 'Ask the AI assistant'
  });

  const form = h('form', {
    onsubmit: e => { e.preventDefault(); if (input.value.trim()) sendMessage(input.value.trim()); input.value = ''; }
  },
    input,
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Ask')
  );

  const prompts = [
    ['🥝 I have waste to get rid of', 'I run a packhouse and we throw out tonnes of fruit skin and pomace every week. What are my options and how do I list it?'],
    ['🔍 I know what material I want', 'I need untreated sawdust or straw for a mushroom farm in Auckland. What is available and how close is it?'],
    ["🤔 I don't know what I need yet", 'I want to start a small business making natural skincare in Otago but I have no idea which waste stream to build it on. Can you help me work it out?']
  ];

  return h('section', { class: 'hero' },
    // The illustrated scene sits behind and below the hero content, so it adds
    // imagery without pushing the headline stats down the page.
    h('div', { class: 'hero-scene', html: heroScene() }),
    h('div', { class: 'hero-inner' },
      h('div', {},
        h('span', { class: 'badge badge-green', style: { marginBottom: '.8rem' } }, '♻ Aotearoa New Zealand · Circular economy'),
        h('h1', {}, 'Waste is only waste ', h('em', {}, 'in the wrong place'), '.'),
        h('p', { class: 'lede' },
          'New Zealand\'s primary industries throw away millions of tonnes of usable material every year — ' +
          'kiwifruit skin, grape marc, mussel shell, sawdust, whey. Waste Opportunities matches the people paying to bury it ' +
          'with the people who need it, and uses AI to work out matches a human broker would never spot.'),
        h('div', { class: 'hero-cta' },
          h('a', { class: 'btn btn-primary btn-lg', href: '#/browse' }, 'Browse available material'),
          h('a', { class: 'btn btn-secondary btn-lg', href: '#/list-waste' }, 'List your waste'),
          h('a', { class: 'btn btn-ghost btn-lg', href: '#/match' }, 'Try the matcher →')
        ),
        h('div', { class: 'hero-stats' },
          heroStat(num(stats.marketplace.activeListings), 'live listings'),
          heroStat(tonnes(stats.potential.tonnesPerYear), 'available per year'),
          heroStat(num(stats.potential.co2AvoidedTonnesPerYear), 't CO₂e at stake'),
          heroStat(stats.marketplace.regionsCovered, 'regions covered')
        )
      ),

      h('div', { class: 'hero-ai' },
        h('h3', {}, h('span', { class: 'avatar' }, '✦'), 'Ask the AI Assistant'),
        h('p', { class: 'small muted', style: { margin: 0 } },
          'Our AI assistant can search the marketplace, work out what material suits your project, and drive this site for you.'),
        form,
        h('div', { class: 'hero-prompts' },
          ...prompts.map(([label, prompt]) =>
            h('button', { type: 'button', onclick: () => sendMessage(prompt) }, label))
        )
      )
    )
  );
}

function heroStat(value, label) {
  return h('div', { class: 'hero-stat' },
    h('div', { class: 'n' }, value),
    h('div', { class: 'l' }, label)
  );
}

// ---------------------------------------------------------------------------

function problemSection(stats) {
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {},
        h('div', { class: 'page-head' }, h('div', { class: 'eyebrow' }, 'The problem')),
        h('h2', {}, 'Two businesses, one truck apart, both losing money')
      )
    ),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' },
        h('div', { class: 'stat-label' }, 'Currently listed, per year'),
        h('div', { class: 'stat-value' }, num(stats.potential.tonnesPerYear)),
        h('div', { class: 'stat-unit' }, 'tonnes of usable material'),
        h('div', { class: 'stat-note' }, 'Most of it currently goes to landfill, effluent fields, or is burnt.')
      ),
      h('div', { class: 'stat amber' },
        h('div', { class: 'stat-label' }, 'Disposal cost at stake'),
        h('div', { class: 'stat-value' }, money(stats.potential.moneySavedNzdPerYear)),
        h('div', { class: 'stat-unit' }, 'paid by producers each year'),
        h('div', { class: 'stat-note' }, 'The NZ waste levy plus gate fees runs $150–$350 a tonne.')
      ),
      h('div', { class: 'stat clay' },
        h('div', { class: 'stat-label' }, 'Climate cost'),
        h('div', { class: 'stat-value' }, num(stats.potential.co2AvoidedTonnesPerYear)),
        h('div', { class: 'stat-unit' }, 't CO₂e per year'),
        h('div', { class: 'stat-note' }, `Equivalent to about ${num(stats.equivalents.carsOffRoadPerYear)} cars off the road.`)
      ),
      h('div', { class: 'stat blue' },
        h('div', { class: 'stat-label' }, 'Already matched'),
        h('div', { class: 'stat-value' }, num(stats.realised.tonnesDiverted)),
        h('div', { class: 'stat-unit' }, 'tonnes diverted'),
        h('div', { class: 'stat-note' }, `Across ${stats.realised.dealsCompleted} completed matches on the platform.`)
      )
    )
  );
}

// ---------------------------------------------------------------------------

function howItWorksSection() {
  const steps = [
    [1, 'List or search', 'A producer lists their waste in under a minute — what it is, how much, where, and how long before it spoils. An acquirer searches, or just describes their project.'],
    [2, 'AI finds the match', 'The AI Assistant scores every listing against the need on relevance, distance, shelf life, volume and cost — then explains why each one made the list.'],
    [3, 'Connect and collect', 'Send an enquiry, agree collection, and the diverted tonnage is added to both parties\' impact record.']
  ];
  return h('section', { class: 'section' },
    h('div', { class: 'page-head' }, h('div', { class: 'eyebrow' }, 'How it works')),
    h('h2', { style: { marginBottom: '1rem' } }, 'Like a marketplace. Matched like a dating app.'),
    h('div', { class: 'how' },
      ...steps.map(([n, title, body]) =>
        h('div', { class: 'how-step' },
          h('div', { class: 'how-art', html: stepArt(n) }),
          h('div', { class: 'how-num' }, String(n)),
          h('h3', {}, title),
          h('p', {}, body)
        ))
    )
  );
}

// ---------------------------------------------------------------------------

function urgentSection(listings) {
  if (!listings.length) return null;
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {},
        h('div', { class: 'eyebrow' }, '⏱ Time critical'),
        h('h2', {}, 'Expiring soon')
      ),
      h('a', { class: 'btn btn-ghost btn-sm', href: '#/browse' }, 'See all →')
    ),
    h('p', { class: 'muted', style: { marginTop: '-.4rem' } },
      'Short shelf life is the hardest problem in primary-industry waste. These become worthless within days.'),
    h('div', { class: 'listing-grid' }, ...listings.map(l => listingCard(l)))
  );
}

// ---------------------------------------------------------------------------

function categoriesSection(stats) {
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'By industry'), h('h2', {}, 'Where the material comes from'))
    ),
    h('div', { class: 'cat-grid' },
      ...stats.byCategory.map(c =>
        h('button', {
          class: 'cat-tile',
          onclick: () => {
            setState({ filters: { ...state.filters, category: c.id, query: '' } });
            navigate('browse');
          }
        },
          h('div', { class: 'cat-art', html: categoryArt(c.id, { crop: 'motif' }) }),
          h('div', { class: 'name' }, `${c.icon} ${c.label}`),
          h('div', { class: 'n' }, `${c.listings} listing${c.listings === 1 ? '' : 's'} · ${num(c.tonnesPerYear)} t/yr`)
        ))
    )
  );
}

// ---------------------------------------------------------------------------

function latestSection(listings) {
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Newest'), h('h2', {}, 'Just listed')),
      h('a', { class: 'btn btn-ghost btn-sm', href: '#/browse' }, 'Browse all →')
    ),
    h('div', { class: 'listing-grid' }, ...listings.map(l => listingCard(l)))
  );
}

// ---------------------------------------------------------------------------

function ctaSection() {
  return h('section', { class: 'card card-pad center', style: { marginTop: '1rem' } },
    h('h2', {}, 'Not sure where you fit?'),
    h('p', { class: 'muted', style: { maxWidth: '52ch', margin: '0 auto 1.2rem' } },
      'Describe your business or your project in plain English. The AI Assistant will work out whether you are a producer, an acquirer, or both — and what to do next.'),
    h('button', {
      class: 'btn btn-primary btn-lg',
      onclick: () => sendMessage('I am not sure whether I should be listing waste or looking for it. Here is my situation: ')
    }, '✦ Talk it through with the AI Assistant')
  );
}
