/**
 * pages/impact.js
 * ---------------
 * The statistics page.
 *
 * The charts here are hand-built from divs — no chart library, nothing to
 * install, and it keeps the whole app dependency-free on the front end.
 *
 * A note on honesty, which matters if a judge asks: we separate REALISED impact
 * (from deals actually completed) from POTENTIAL impact (what the currently
 * listed material would achieve if it all found a home). Blurring those two is
 * the most common way sustainability dashboards mislead people.
 */

import { h, render, num, money, tonnes, date, loadingBlock } from '../utils.js';
import { api } from '../api.js';
import { sendMessage } from '../chat.js';

export const impactPage = {
  async render(container) {
    render(container, h('div', { class: 'page' }, loadingBlock('Crunching the numbers…')));

    const [stats, me] = await Promise.all([api.stats(), api.me()]);

    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'Impact'),
          h('h1', { style: { fontSize: '2rem' } }, 'What Waste Opportunities is actually saving'),
          h('p', { class: 'lede' },
            'Two sets of numbers, kept deliberately separate: what has already been diverted through completed ' +
            'matches, and what is sitting on the marketplace waiting for a taker.')
        ),

        realisedSection(stats),
        potentialSection(stats),
        equivalentsSection(stats),
        trendSection(stats),
        categorySection(stats),
        regionSection(stats),
        dealsSection(me.deals),
        methodologySection(),

        h('div', { class: 'center', style: { marginTop: '2rem' } },
          h('button', {
            class: 'btn btn-primary btn-lg',
            onclick: () => sendMessage('Walk me through the impact numbers on Waste Opportunities. Which industry is contributing most, and where is the biggest untapped opportunity?')
          }, '✦ Have the AI Assistant explain these numbers')
        )
      )
    );
  }
};

// ---------------------------------------------------------------------------

function realisedSection(s) {
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {},
        h('div', { class: 'eyebrow' }, 'Realised'),
        h('h2', {}, 'Already diverted through completed matches'))
    ),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' },
        h('div', { class: 'stat-label' }, 'Material diverted'),
        h('div', { class: 'stat-value' }, num(s.realised.tonnesDiverted)),
        h('div', { class: 'stat-unit' }, 'tonnes kept out of landfill')),
      h('div', { class: 'stat amber' },
        h('div', { class: 'stat-label' }, 'Emissions avoided'),
        h('div', { class: 'stat-value' }, num(s.realised.co2AvoidedTonnes)),
        h('div', { class: 'stat-unit' }, 'tonnes CO₂e')),
      h('div', { class: 'stat clay' },
        h('div', { class: 'stat-label' }, 'Disposal cost avoided'),
        h('div', { class: 'stat-value' }, money(s.realised.moneySavedNzd)),
        h('div', { class: 'stat-unit' }, 'saved by producers')),
      h('div', { class: 'stat blue' },
        h('div', { class: 'stat-label' }, 'Matches completed'),
        h('div', { class: 'stat-value' }, num(s.realised.dealsCompleted)),
        h('div', { class: 'stat-unit' }, 'producer ↔ acquirer deals'))
    )
  );
}

function potentialSection(s) {
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {},
        h('div', { class: 'eyebrow' }, 'Potential'),
        h('h2', {}, 'On the marketplace right now, annualised'))
    ),
    h('p', { class: 'muted', style: { marginTop: '-.5rem' } },
      `${s.marketplace.activeListings} live listings across ${s.marketplace.regionsCovered} regions. ` +
      `${s.marketplace.urgentListings} of them will spoil within a week if nobody collects.`),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' },
        h('div', { class: 'stat-label' }, 'Available per year'),
        h('div', { class: 'stat-value' }, num(s.potential.tonnesPerYear)),
        h('div', { class: 'stat-unit' }, 'tonnes')),
      h('div', { class: 'stat amber' },
        h('div', { class: 'stat-label' }, 'CO₂e at stake per year'),
        h('div', { class: 'stat-value' }, num(s.potential.co2AvoidedTonnesPerYear)),
        h('div', { class: 'stat-unit' }, 'tonnes')),
      h('div', { class: 'stat clay' },
        h('div', { class: 'stat-label' }, 'Disposal cost at stake'),
        h('div', { class: 'stat-value' }, money(s.potential.moneySavedNzdPerYear)),
        h('div', { class: 'stat-unit' }, 'NZD per year')),
      h('div', { class: 'stat blue' },
        h('div', { class: 'stat-label' }, 'Open demand'),
        h('div', { class: 'stat-value' }, num(s.marketplace.openWants)),
        h('div', { class: 'stat-unit' }, 'wanted requests'))
    )
  );
}

/** Turn abstract tonnages into things a human can picture. */
function equivalentsSection(s) {
  const items = [
    ['🚗', num(s.equivalents.carsOffRoadPerYear), 'petrol cars taken off New Zealand roads for a year'],
    ['🚛', num(s.equivalents.truckloadsDiverted), 'rubbish truckloads kept out of landfill each year'],
    ['🏠', num(s.equivalents.householdsEquivalent), 'average NZ households\' annual carbon footprint']
  ];
  return h('section', { class: 'section' },
    h('div', { class: 'card card-pad' },
      h('h3', {}, 'What that actually looks like'),
      h('div', { class: 'stat-grid', style: { marginTop: '.8rem' } },
        ...items.map(([icon, n, label]) =>
          h('div', { style: { display: 'flex', gap: '.8rem', alignItems: 'center' } },
            h('div', { style: { fontSize: '2.2rem' } }, icon),
            h('div', {},
              h('div', { style: { fontSize: '1.5rem', fontWeight: '750', lineHeight: '1.1' } }, n),
              h('div', { class: 'small muted' }, label)
            )
          ))
      )
    )
  );
}

/** Six-month bar chart of completed deals. */
function trendSection(s) {
  const max = Math.max(1, ...s.monthlyTrend.map(m => m.tonnes));
  return h('section', { class: 'section' },
    h('h2', {}, 'Diversion over the last six months'),
    h('div', { class: 'card card-pad' },
      h('div', { class: 'spark' },
        ...s.monthlyTrend.map(m =>
          h('div', { class: 'spark-col', title: `${m.label}: ${num(m.tonnes)} t` },
            h('div', { class: 'small muted', style: { fontVariantNumeric: 'tabular-nums' } }, num(m.tonnes)),
            h('div', { class: 'spark-bar', style: { height: `${Math.max(4, (m.tonnes / max) * 100)}%` } }),
            h('div', { class: 'spark-label' }, m.label)
          ))
      ),
      h('p', { class: 'small muted', style: { marginTop: '.8rem', marginBottom: 0 } },
        'Tonnes diverted per month through completed matches.')
    )
  );
}

/** Horizontal bar chart by industry. */
function categorySection(s) {
  const max = Math.max(1, ...s.byCategory.map(c => c.tonnesPerYear));
  return h('section', { class: 'section' },
    h('h2', {}, 'Where the volume is, by industry'),
    h('div', { class: 'card card-pad' },
      h('div', { class: 'bar-chart' },
        ...s.byCategory.map(c =>
          h('div', { class: 'bar-row' },
            h('div', { class: 'bar-label' }, `${c.icon} ${c.label}`),
            h('div', { class: 'bar-track' },
              h('div', { class: 'bar-fill', style: { width: `${(c.tonnesPerYear / max) * 100}%` } })),
            h('div', { class: 'bar-value' }, `${num(c.tonnesPerYear)} t`)
          ))
      ),
      h('p', { class: 'small muted', style: { marginTop: '.9rem', marginBottom: 0 } },
        'Annualised tonnage of currently listed material.')
    )
  );
}

/** Horizontal bar chart by region. */
function regionSection(s) {
  const max = Math.max(1, ...s.byRegion.map(r => r.tonnesPerYear));
  return h('section', { class: 'section' },
    h('h2', {}, 'Where in the motu'),
    h('div', { class: 'card card-pad' },
      h('div', { class: 'bar-chart' },
        ...s.byRegion.map(r =>
          h('div', { class: 'bar-row' },
            h('div', { class: 'bar-label' }, r.region),
            h('div', { class: 'bar-track' },
              h('div', { class: 'bar-fill amber', style: { width: `${(r.tonnesPerYear / max) * 100}%` } })),
            h('div', { class: 'bar-value' }, `${num(r.tonnesPerYear)} t`)
          ))
      ),
      h('p', { class: 'small muted', style: { marginTop: '.9rem', marginBottom: 0 } },
        `${s.byRegion.length} of 16 regions currently have listings. The gaps are where the platform needs growth.`)
    )
  );
}

/** Table of recent completed deals. */
function dealsSection(deals) {
  if (!deals?.length) return null;
  return h('section', { class: 'section' },
    h('h2', {}, 'Recent matches'),
    h('div', { class: 'card card-pad table-wrap' },
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Material'), h('th', {}, 'Went to'), h('th', {}, 'Tonnes'),
          h('th', {}, 't CO₂e'), h('th', {}, 'Saved'), h('th', {}, 'When'))),
        h('tbody', {},
          ...deals.map(d => h('tr', {},
            h('td', {}, d.listingTitle),
            h('td', {}, d.buyer),
            h('td', {}, num(d.tonnes)),
            h('td', {}, num(d.co2Saved)),
            h('td', {}, money(d.moneySaved)),
            h('td', { class: 'muted' }, date(d.completedAt))
          )))
      )
    )
  );
}

/** Be explicit about where the numbers come from — judges will ask. */
function methodologySection() {
  return h('section', { class: 'section' },
    h('details', { class: 'card card-pad' },
      h('summary', { style: { cursor: 'pointer', fontWeight: '650' } }, 'How these numbers are calculated'),
      h('div', { style: { marginTop: '.9rem' } },
        h('p', {}, h('strong', {}, 'Tonnage. '),
          'Each listing states an amount, a unit and a frequency. Non-tonne units are converted with standard ' +
          'density assumptions (bulk organics ≈ 400 kg/m³, a large bale ≈ 250 kg), then multiplied by how often ' +
          'the material becomes available across a year.'),
        h('p', {}, h('strong', {}, 'CO₂e. '),
          'Each material carries its own emissions factor for tonnes of CO₂e avoided per tonne diverted. Wet ' +
          'organics sit around 0.6 because the dominant benefit is avoided landfill methane; plastics are higher ' +
          'because recycling displaces virgin polymer production; inert shell is low.'),
        h('p', {}, h('strong', {}, 'Money. '),
          'The disposal cost each producer states they currently pay, which in New Zealand combines the waste ' +
          'disposal levy with transport and gate fees — typically $150 to $350 a tonne.'),
        h('p', { style: { marginBottom: 0 } }, h('strong', {}, 'Honesty note. '),
          'Potential impact assumes every listing finds a taker, which will never be fully true. It is a measure ' +
          'of the opportunity on the table, not a claim about delivered outcomes. Realised impact is the number ' +
          'that should be judged.')
      )
    )
  );
}
