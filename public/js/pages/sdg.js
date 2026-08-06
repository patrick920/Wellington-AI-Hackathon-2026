/**
 * pages/sdg.js
 * ------------
 * The UN Sustainable Development Goals page.
 *
 * Judges at a sustainability hackathon will ask "which goals, and how?" — so
 * this page names the specific TARGETS (12.3, 12.5, 13.2 …) rather than just
 * the goal numbers, states what LoopNZ actually does against each one, and
 * pulls a live metric off the platform where one exists.
 *
 * Colours are the official UN goal colours.
 */

import { h, render, num, money, loadingBlock } from '../utils.js';
import { api } from '../api.js';
import { sendMessage } from '../chat.js';

/**
 * The goal data. `primary: true` means this is a goal LoopNZ addresses head-on
 * rather than contributing to indirectly.
 *
 * `metric(stats)` returns a live figure from the platform, or null.
 */
const GOALS = [
  {
    n: 12, color: '#BF8B2E', primary: true,
    name: 'Responsible Consumption and Production',
    summary: 'This is the goal LoopNZ exists to serve. Every listing is material leaving the linear take-make-dispose model and re-entering production as an input.',
    targets: [
      '12.3 — Halve per-capita food waste and reduce food losses along production and supply chains',
      '12.4 — Environmentally sound management of wastes throughout their life cycle',
      '12.5 — Substantially reduce waste generation through prevention, reduction, recycling and reuse',
      '12.6 — Encourage companies to adopt sustainable practices and report on them'
    ],
    how: [
      'Turns waste into a listed, priced, findable resource rather than a disposal line item',
      'AI matching finds reuse pathways a producer would never think to look for',
      'Every producer gets an impact record they can put in their sustainability reporting'
    ],
    metric: s => [`${num(s.potential.tonnesPerYear)} t/yr`, 'of material currently listed for reuse']
  },
  {
    n: 13, color: '#3F7E44', primary: true,
    name: 'Climate Action',
    summary: 'Organic waste in landfill decomposes anaerobically and releases methane, which traps roughly 28 times more heat than CO₂ over a century. Diverting it is one of the cheapest emissions reductions available to New Zealand.',
    targets: [
      '13.2 — Integrate climate change measures into national policies, strategies and planning',
      '13.3 — Improve education and awareness-raising on climate change mitigation'
    ],
    how: [
      'Avoids landfill methane from wet organic streams',
      'Displaces virgin material production — recycled LDPE, agricultural lime, imported protein meal',
      'Scores matches on distance, so freight emissions never quietly cancel out the saving'
    ],
    metric: s => [`${num(s.potential.co2AvoidedTonnesPerYear)} t CO₂e`, `at stake per year — about ${num(s.equivalents.carsOffRoadPerYear)} cars off the road`]
  },
  {
    n: 9, color: '#FD6925', primary: true,
    name: 'Industry, Innovation and Infrastructure',
    summary: 'Industrial symbiosis — one industry\'s output becoming another\'s input — normally requires a physical eco-industrial park. LoopNZ builds that network digitally across a whole country.',
    targets: [
      '9.4 — Upgrade infrastructure and retrofit industries to be sustainable, with greater resource-use efficiency',
      '9.5 — Enhance scientific research and upgrade technological capabilities of industrial sectors'
    ],
    how: [
      'Connects sectors that have no existing commercial relationship — a fishery and a cosmetics lab',
      'Gives researchers a reliable, documented feedstock supply for pilot-scale work',
      'Makes the AI matching layer the shared infrastructure, not a physical site'
    ],
    metric: s => [`${s.byCategory.length} industries`, `trading across ${s.marketplace.regionsCovered} regions`]
  },
  {
    n: 8, color: '#A21942', primary: true,
    name: 'Decent Work and Economic Growth',
    summary: 'Rural New Zealand businesses currently pay to destroy material that has value. Converting that cost into revenue keeps money and jobs in regional economies.',
    targets: [
      '8.4 — Improve global resource efficiency and decouple economic growth from environmental degradation',
      '8.3 — Support productive activities, decent job creation, entrepreneurship and innovation'
    ],
    how: [
      'Removes a real cash cost from primary producers operating on thin margins',
      'Lowers the barrier for small manufacturers who cannot afford virgin raw material',
      'Creates a new category of regional business built on secondary materials'
    ],
    metric: s => [money(s.potential.moneySavedNzdPerYear), 'in disposal costs currently at stake each year']
  },
  {
    n: 2, color: '#DDA63A',
    name: 'Zero Hunger',
    summary: 'A large share of what LoopNZ lists is edible or feed-grade material that is only "waste" because it failed a cosmetic grade.',
    targets: ['2.4 — Ensure sustainable food production systems and resilient agricultural practices'],
    how: [
      'Redirects grade-out fruit and vegetables to food manufacture rather than landfill',
      'Supplies low-cost stock feed from pomace, spent grain and processing residues'
    ],
    metric: null
  },
  {
    n: 14, color: '#0A97D9',
    name: 'Life Below Water',
    summary: 'Aquaculture and fishing waste is both a disposal problem and a restoration resource.',
    targets: ['14.1 — Prevent and significantly reduce marine pollution of all kinds'],
    how: [
      'Finds land-based uses for mussel and oyster shell instead of sea dumping or stockpiling',
      'Routes fish frames and offal into oil, collagen and fertiliser rather than discharge',
      'Recovers agricultural plastic before it reaches waterways'
    ],
    metric: null
  },
  {
    n: 15, color: '#56C02B',
    name: 'Life on Land',
    summary: 'Composted and processed organic waste rebuilds soil carbon and structure — the opposite of what landfilling it achieves.',
    targets: ['15.3 — Combat desertification, restore degraded land and soil'],
    how: [
      'Channels organic residues into compost, biochar and soil conditioners',
      'Substitutes shell-derived lime for quarried and imported agricultural lime',
      'Reduces the land area needed for effluent disposal and landfill'
    ],
    metric: null
  },
  {
    n: 11, color: '#FD9D24',
    name: 'Sustainable Cities and Communities',
    summary: 'Regional landfills are a finite, expensive and politically difficult resource. Every tonne diverted extends their life.',
    targets: ['11.6 — Reduce the adverse per-capita environmental impact of cities, including waste management'],
    how: [
      'Reduces pressure on regional landfill capacity',
      'Cuts heavy-truck movements to disposal sites by matching locally first'
    ],
    metric: s => [`${num(s.equivalents.truckloadsDiverted)}`, 'truckloads a year kept out of landfill']
  },
  {
    n: 6, color: '#26BDE2',
    name: 'Clean Water and Sanitation',
    summary: 'Dairy effluent, whey permeate and wool-scour waste are all water-quality problems when land-applied beyond consent limits.',
    targets: ['6.3 — Improve water quality by reducing pollution and minimising release of hazardous materials'],
    how: [
      'Gives high-nutrient liquid streams a productive outlet instead of an effluent field',
      'Reduces nitrogen and phosphorus loading in catchments already under pressure'
    ],
    metric: null
  },
  {
    n: 17, color: '#19486A',
    name: 'Partnerships for the Goals',
    summary: 'None of this works as a single-company initiative. The platform is the partnership.',
    targets: ['17.16 — Enhance multi-stakeholder partnerships that mobilise knowledge, expertise and technology'],
    how: [
      'Puts growers, processors, researchers, iwi enterprises and manufacturers on one marketplace',
      'Publishes the impact methodology openly so results can be challenged and improved'
    ],
    metric: null
  }
];

export const sdgPage = {
  async render(container) {
    render(container, h('div', { class: 'page' }, loadingBlock('Loading…')));
    const stats = await api.stats();

    const primary = GOALS.filter(g => g.primary);
    const secondary = GOALS.filter(g => !g.primary);

    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'Alignment'),
          h('h1', { style: { fontSize: '2rem' } }, 'UN Sustainable Development Goals'),
          h('p', { class: 'lede' },
            'LoopNZ addresses four goals directly and contributes to six more. Each card names the specific UN ' +
            'targets involved, what the platform actually does about them, and — where we can measure it — a live ' +
            'figure from the marketplace.')
        ),

        h('section', { class: 'section' },
          h('h2', {}, 'Directly addressed'),
          h('div', { class: 'sdg-grid' }, ...primary.map(g => sdgCard(g, stats)))
        ),

        h('section', { class: 'section' },
          h('h2', {}, 'Also contributed to'),
          h('div', { class: 'sdg-grid' }, ...secondary.map(g => sdgCard(g, stats)))
        ),

        h('section', { class: 'card card-pad' },
          h('h3', {}, 'Why a marketplace, rather than a policy or a plant?'),
          h('p', {},
            'New Zealand already has the technology to use most of this material — the pectin chemistry, the ' +
            'anaerobic digesters, the shell crushers all exist. What is missing is the information layer: a ' +
            'kiwifruit packhouse in Te Puke has no way of knowing a pectin start-up two hours away needs exactly ' +
            'what they are paying to bury.'),
          h('p', { style: { marginBottom: 0 } },
            'That is a matching problem, and matching problems are what AI is genuinely good at. LoopNZ is built ' +
            'on the bet that the cheapest tonne of carbon in the primary sector is the one already sitting in a ' +
            'skip, waiting for someone to be told about it.')
        ),

        h('div', { class: 'center', style: { marginTop: '1.6rem' } },
          h('button', {
            class: 'btn btn-primary btn-lg',
            onclick: () => sendMessage('Explain how LoopNZ contributes to the UN Sustainable Development Goals, and use the live platform statistics to back it up.')
          }, '✦ Ask Kōwhai to make the case')
        )
      )
    );
  }
};

/** One SDG card. */
function sdgCard(goal, stats) {
  const metric = goal.metric?.(stats);
  return h('article', { class: `sdg-card${goal.primary ? ' sdg-primary' : ''}` },
    h('div', { class: 'sdg-band', style: { background: goal.color } },
      h('div', { class: 'num' }, String(goal.n)),
      h('div', { class: 'name' }, goal.name)
    ),
    h('div', { class: 'sdg-body' },
      h('p', { style: { marginBottom: '.6rem' } }, goal.summary),

      metric
        ? h('div', {
            style: {
              background: 'var(--surface-2)', borderRadius: '10px', padding: '.6rem .75rem', marginBottom: '.7rem'
            }
          },
            h('div', { style: { fontSize: '1.35rem', fontWeight: '750', lineHeight: '1.1' } }, metric[0]),
            h('div', { class: 'small muted' }, metric[1]))
        : null,

      h('h4', {}, 'UN targets'),
      h('ul', {}, ...goal.targets.map(t => h('li', { class: 'small' }, t))),

      h('h4', {}, 'What LoopNZ does'),
      h('ul', {}, ...goal.how.map(x => h('li', {}, x)))
    )
  );
}
