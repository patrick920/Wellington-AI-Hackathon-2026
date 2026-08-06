/**
 * components.js
 * -------------
 * Reusable UI pieces shared across pages: the listing card, the badges that
 * describe a listing at a glance, and the slide-in detail drawer.
 */

import { h, num, tonnes, timeAgo, priceLabel, priceBadgeClass, toast, esc } from './utils.js';
import { state, categoryById } from './state.js';
import { api } from './api.js';

/**
 * The set of small badges that summarise a listing.
 * Order matters — the most decision-relevant information comes first.
 */
export function listingBadges(listing, { showDistance = true } = {}) {
  const cat = categoryById(listing.category);
  const badges = [
    h('span', { class: 'badge' }, `${cat.icon} ${cat.label}`),
    h('span', { class: `badge ${priceBadgeClass(listing.priceType)}` }, priceLabel(listing))
  ];

  // Shelf-life urgency is the single most important constraint for
  // primary-industry waste, so it gets a loud badge when it's short.
  const u = listing.urgency;
  if (u) {
    const cls = { critical: 'badge-danger', high: 'badge-amber', medium: 'badge', low: 'badge-green' }[u.level];
    badges.push(h('span', { class: `badge ${cls}` }, `⏱ ${u.label}`));
  }

  if (listing.visibility === 'private') {
    badges.push(h('span', { class: 'badge badge-clay' }, '🔒 Private'));
  }

  if (showDistance && listing.distanceKm != null) {
    // Distances are measured between regional centres, so anything in the
    // user's own region comes out as 0 km. "0 km away" reads like a glitch —
    // say what it actually means.
    badges.push(h('span', { class: 'badge' },
      listing.distanceKm === 0 ? '📍 Your region' : `📍 ${num(listing.distanceKm)} km`));
  }

  return badges;
}

/**
 * A marketplace card. Clicking it opens the detail drawer.
 * @param {object} listing
 * @param {object} [opts]
 * @param {number} [opts.score]    match score 0-100, shows a progress ring
 * @param {boolean}[opts.highlight] draw the "AI pick" treatment
 */
export function listingCard(listing, opts = {}) {
  const cat = categoryById(listing.category);
  const isHighlighted = opts.highlight ?? state.highlighted.includes(listing.id);

  const card = h('article', {
    class: `listing-card${isHighlighted ? ' highlighted' : ''}`,
    dataset: { listingId: listing.id },
    tabindex: '0',
    role: 'button',
    onclick: () => openListingDrawer(listing.id),
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openListingDrawer(listing.id); } }
  },
    h('div', { class: 'listing-thumb' },
      h('span', {}, cat.icon),
      opts.score != null
        ? h('div', { class: 'score-ring', style: { '--pct': String(opts.score) } }, h('span', {}, `${opts.score}%`))
        : null
    ),
    h('div', { class: 'listing-body' },
      h('h3', { class: 'listing-title' }, listing.title),
      h('div', { class: 'listing-meta' }, ...listingBadges(listing)),
      h('p', { class: 'listing-desc' }, listing.description || ''),
      h('div', { class: 'listing-facts' },
        h('span', {}, h('b', {}, `${num(listing.quantity.amount)} ${listing.quantity.unit}`), ` ${listing.quantity.frequency}`),
        h('span', {}, '📍 ', h('b', {}, listing.city || listing.region)),
        h('span', {}, `👁 ${num(listing.views || 0)}`),
        h('span', {}, timeAgo(listing.createdAt))
      )
    )
  );
  return card;
}

/** Render a grid of listing cards, or an empty state. */
export function listingGrid(listings, opts = {}) {
  if (!listings.length) {
    return h('div', { class: 'empty' },
      h('div', { class: 'big' }, '🔍'),
      h('h3', {}, 'Nothing matches those filters'),
      h('p', { class: 'muted' }, 'Try widening the distance, clearing the category, or asking Kōwhai to find something for you.')
    );
  }
  return h('div', { class: 'listing-grid' },
    ...listings.map(l => listingCard(l, { ...opts, score: opts.scores?.[l.id] })));
}

// ---------------------------------------------------------------------------
// Listing detail drawer
// ---------------------------------------------------------------------------

const drawerEl = () => document.getElementById('listingDrawer');
const scrimEl = () => document.getElementById('drawerScrim');

/** Close the detail drawer. */
export function closeDrawer() {
  drawerEl().classList.remove('open');
  drawerEl().setAttribute('aria-hidden', 'true');
  scrimEl().hidden = true;
}

/**
 * Open the detail drawer for a listing. Fetches fresh data so the view count
 * increments and any AI-created changes are reflected.
 */
export async function openListingDrawer(listingId) {
  const drawer = drawerEl();
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  scrimEl().hidden = false;
  drawer.replaceChildren(h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Loading listing…'));

  let listing;
  try {
    ({ listing } = await api.listing(listingId));
  } catch (err) {
    drawer.replaceChildren(h('div', { class: 'drawer-body' }, h('p', {}, `Could not load that listing: ${err.message}`)));
    return;
  }

  const cat = categoryById(listing.category);
  const annualTonnes = estimateAnnualTonnes(listing);

  drawer.replaceChildren(
    h('div', { class: 'drawer-head' },
      h('div', {},
        h('div', { class: 'muted small' }, `${cat.icon} ${cat.label}`),
        h('h2', { style: { margin: '.2rem 0 0', fontSize: '1.4rem' } }, listing.title)
      ),
      h('button', { class: 'btn btn-ghost btn-icon', onclick: closeDrawer, 'aria-label': 'Close' }, '✕')
    ),

    h('div', { class: 'drawer-body' },
      h('div', { class: 'row', style: { marginBottom: '1rem' } }, ...listingBadges(listing)),

      h('p', {}, listing.description),

      // --- Key facts -----------------------------------------------------
      h('h3', { style: { marginTop: '1.4rem' } }, 'Key facts'),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Material'), h('dd', {}, listing.wasteType),
        h('dt', {}, 'Quantity'), h('dd', {}, `${num(listing.quantity.amount)} ${listing.quantity.unit}, ${listing.quantity.frequency}`),
        h('dt', {}, 'Approx. per year'), h('dd', {}, tonnes(annualTonnes)),
        h('dt', {}, 'Location'), h('dd', {}, `${listing.city ? listing.city + ', ' : ''}${listing.region}${listing.distanceKm != null ? ` · ${num(listing.distanceKm)} km from you` : ''}`),
        h('dt', {}, 'Condition'), h('dd', {}, listing.condition),
        h('dt', {}, 'Shelf life'), h('dd', {}, `${listing.shelfLifeDays} days${listing.shelfLifeDays <= 3 ? ' — collect fast' : ''}`),
        h('dt', {}, 'Price'), h('dd', {}, priceLabel(listing)),
        h('dt', {}, 'Visibility'), h('dd', {}, listing.visibility === 'private'
          ? 'Private — only revealed to strong AI matches'
          : 'Public'),
        h('dt', {}, 'Listed'), h('dd', {}, timeAgo(listing.createdAt)),
        h('dt', {}, 'Interest'), h('dd', {}, `${num(listing.interestCount || 0)} enquiries · ${num(listing.views || 0)} views`)
      ),

      // --- Environmental value -------------------------------------------
      h('h3', { style: { marginTop: '1.4rem' } }, 'If this were diverted'),
      h('div', { class: 'stat-grid', style: { marginBottom: '.4rem' } },
        h('div', { class: 'stat' },
          h('div', { class: 'stat-label' }, 'CO₂e avoided / yr'),
          h('div', { class: 'stat-value' }, num(annualTonnes * (listing.co2PerTonne || 0.6))),
          h('div', { class: 'stat-unit' }, 'tonnes')
        ),
        h('div', { class: 'stat amber' },
          h('div', { class: 'stat-label' }, 'Disposal cost avoided / yr'),
          h('div', { class: 'stat-value' }, `$${num(annualTonnes * (listing.disposalCostPerTonne || 150))}`),
          h('div', { class: 'stat-unit' }, 'NZD')
        )
      ),
      h('p', { class: 'small muted' },
        `Based on ${listing.co2PerTonne} t CO₂e and $${listing.disposalCostPerTonne} landfill cost per tonne of this material.`),

      // --- Suggested uses -------------------------------------------------
      listing.suggestedUses?.length
        ? h('div', {},
            h('h3', { style: { marginTop: '1.4rem' } }, 'What it can be used for'),
            h('div', { class: 'uses-list' },
              ...listing.suggestedUses.map(u => h('div', { class: 'use-item' }, u)))
          )
        : null,

      // --- Contact ---------------------------------------------------------
      h('h3', { style: { marginTop: '1.4rem' } }, 'Producer'),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Organisation'), h('dd', {}, listing.contact?.org || '—'),
        h('dt', {}, 'Contact'), h('dd', {}, listing.contact?.name || '—'),
        h('dt', {}, 'Email'), h('dd', {}, listing.contact?.email
          ? h('a', { href: `mailto:${listing.contact.email}` }, listing.contact.email) : '—'),
        h('dt', {}, 'Phone'), h('dd', {}, listing.contact?.phone || '—')
      ),

      // --- Actions ---------------------------------------------------------
      enquiryForm(listing)
    )
  );
}

/** The "send an enquiry" form at the bottom of the drawer. */
function enquiryForm(listing) {
  const textarea = h('textarea', {
    placeholder: `Tell ${listing.contact?.name || 'the producer'} what you would use this for, your volume, and when you could collect…`,
    rows: '4'
  });
  const nameInput = h('input', { type: 'text', placeholder: 'Your name' });
  const orgInput = h('input', { type: 'text', placeholder: 'Your organisation' });

  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Send enquiry');

  const form = h('form', {
    style: { marginTop: '1.6rem' },
    onsubmit: async e => {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Sending…';
      try {
        await api.createRequest({
          listingId: listing.id,
          message: textarea.value,
          fromName: nameInput.value || 'You',
          fromOrg: orgInput.value || ''
        });
        toast('Enquiry sent — see it in your Dashboard', 'success');
        closeDrawer();
      } catch (err) {
        toast(`Could not send: ${err.message}`, 'warn');
        submit.disabled = false;
        submit.textContent = 'Send enquiry';
      }
    }
  },
    h('h3', {}, 'Enquire about this material'),
    h('div', { class: 'field-row' },
      h('div', { class: 'field' }, h('label', {}, 'Your name'), nameInput),
      h('div', { class: 'field' }, h('label', {}, 'Organisation'), orgInput)
    ),
    h('div', { class: 'field' }, h('label', {}, 'Message'), textarea),
    h('div', { class: 'row' },
      submit,
      h('button', {
        class: 'btn btn-secondary', type: 'button',
        onclick: async () => {
          await api.toggleSaved(listing.id);
          toast('Saved to your shortlist', 'success');
        }
      }, '♥ Save'),
      h('button', {
        class: 'btn btn-ghost', type: 'button',
        // Hands the listing to the AI so it can explain uses in context
        onclick: () => {
          window.dispatchEvent(new CustomEvent('loopnz:ask', {
            detail: { message: `Tell me more about the listing "${listing.title}" (id ${listing.id}). What could I realistically make from it, what processing would I need, and is the shelf life workable?` }
          }));
          closeDrawer();
        }
      }, '✦ Ask Kōwhai about this')
    )
  );
  return form;
}

/**
 * Estimate annual tonnage from a listing's quantity + frequency.
 * Mirrors the server-side logic so the drawer can show it without another call.
 */
function estimateAnnualTonnes(listing) {
  const unitToTonnes = { tonnes: 1, kg: 0.001, 'cubic metres': 0.4, litres: 0.001, bales: 0.25, pallets: 0.5 };
  const perYear = { 'one-off': 1, daily: 250, weekly: 52, fortnightly: 26, monthly: 12, seasonal: 3 };
  const t = (listing.quantity.amount || 0) * (unitToTonnes[listing.quantity.unit] ?? 1);
  return t * (perYear[listing.quantity.frequency] ?? 1);
}

/** Wire up the drawer scrim once at startup. */
export function initDrawer() {
  scrimEl().addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawerEl().classList.contains('open')) closeDrawer();
  });
}
