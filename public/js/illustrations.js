/**
 * illustrations.js
 * ----------------
 * All the artwork for the site, as hand-written inline SVG.
 *
 * WHY SVG AND NOT PHOTOGRAPHS:
 *   - No external requests. The whole app still runs offline with no CDN, which
 *     is the property that lets the demo survive bad conference wifi.
 *   - No licensing question. Stock photos of New Zealand packhouses would need
 *     clearing; these are drawn for the project.
 *   - They scale to any screen and recolour for dark mode without a second set
 *     of files.
 *
 * HOW TO EDIT:
 * Each function returns an SVG string. Colours come from the PALETTE object
 * below — change those and every illustration re-skins at once. Shapes use a
 * flat, layered style: solid fills, no strokes except a few accent lines.
 *
 * Usage:  el.innerHTML = heroScene();
 *         h('div', { html: categoryArt('dairy') })
 */

/**
 * Shared colour palette. Deliberately hard-coded rather than using CSS
 * variables: these tones are chosen to read correctly on BOTH the light and
 * dark card backgrounds, so they should not follow the theme.
 */
const P = {
  // Greens — pasture, forestry, the brand
  greenDark: '#0f5c40',
  green: '#1c9a6d',
  greenLight: '#74c9a8',
  greenPale: '#c8e9d9',

  // Earth — soil, timber, hides
  clay: '#a4552f',
  clayLight: '#d08a5f',
  sand: '#e8d5b5',

  // Harvest — fruit, straw, amber
  amber: '#e39a2c',
  amberDeep: '#c8791a',
  wheat: '#e6c56b',

  // Water — sea, dairy, sky
  blue: '#2a6099',
  blueLight: '#7fb0dc',
  bluePale: '#d9e9f7',

  // Neutrals
  slate: '#5a6b62',
  ink: '#16211c',
  paper: '#f6f4ee',
  white: '#ffffff'
};

// ---------------------------------------------------------------------------
// Hero: the landscape strip that anchors the bottom of the home page hero
// ---------------------------------------------------------------------------

/**
 * A wide New Zealand primary-industry scene: rolling hills, a packhouse,
 * orchard bins of fruit waste, a log stack, mussel sacks and a collection
 * truck — with a circular arrow tying it together.
 *
 * Drawn on a 1200x300 canvas and stretched full-bleed, so it works as a band
 * across the bottom of the hero at any width.
 */
export function heroScene() {
  return `
<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" role="img"
     aria-label="Illustration of a New Zealand packhouse with orchard bins of fruit waste, a log stack, mussel shell sacks and a collection truck">
  <defs>
    <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${P.greenLight}"/>
      <stop offset="100%" stop-color="${P.green}"/>
    </linearGradient>
    <linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${P.green}"/>
      <stop offset="100%" stop-color="${P.greenDark}"/>
    </linearGradient>
  </defs>

  <!-- ---------- Rolling hills ---------- -->
  <path d="M0,150 C120,105 210,140 330,120 C450,100 520,140 640,125
           C760,110 850,145 960,128 C1060,112 1140,140 1200,130 L1200,300 L0,300 Z"
        fill="url(#hillFar)" opacity=".55"/>
  <path d="M0,185 C140,150 240,180 380,168 C520,156 600,190 740,175
           C880,160 980,192 1090,180 C1140,174 1180,182 1200,180 L1200,300 L0,300 Z"
        fill="url(#hillNear)" opacity=".8"/>

  <!-- Shelter-belt trees along the ridge -->
  ${[70, 105, 140, 900, 935, 970, 1005].map(x => `
    <g transform="translate(${x},0)">
      <rect x="-2" y="150" width="4" height="22" fill="${P.greenDark}" opacity=".7"/>
      <ellipse cx="0" cy="146" rx="13" ry="20" fill="${P.greenDark}" opacity=".65"/>
    </g>`).join('')}

  <!-- ---------- Packhouse shed ---------- -->
  <g transform="translate(150,120)">
    <rect x="0" y="34" width="210" height="86" rx="3" fill="${P.sand}"/>
    <path d="M-12,34 L105,2 L222,34 Z" fill="${P.clay}"/>
    <rect x="0" y="34" width="210" height="6" fill="${P.clayLight}" opacity=".6"/>
    <!-- Roller door -->
    <rect x="26" y="62" width="58" height="58" rx="2" fill="${P.slate}" opacity=".35"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="26" y="${68 + i * 11}" width="58" height="2" fill="${P.slate}" opacity=".4"/>`).join('')}
    <!-- Windows -->
    ${[110, 146, 182].map(x => `<rect x="${x}" y="60" width="22" height="20" rx="2" fill="${P.bluePale}" opacity=".9"/>`).join('')}
  </g>

  <!-- ---------- Orchard bins of fruit waste ---------- -->
  <g transform="translate(400,206)">
    ${[0, 82, 164].map((dx, i) => `
      <g transform="translate(${dx},${i === 1 ? -6 : 0})">
        <!-- Overflowing fruit waste -->
        <ellipse cx="32" cy="6" rx="34" ry="11" fill="${i === 1 ? P.amber : P.greenLight}"/>
        <circle cx="14" cy="1"  r="8" fill="${i === 1 ? P.amberDeep : P.green}"/>
        <circle cx="34" cy="-3" r="9" fill="${i === 1 ? P.amber : P.greenLight}"/>
        <circle cx="52" cy="2"  r="7" fill="${i === 1 ? P.wheat : P.green}"/>
        <!-- Kiwifruit cross-section detail -->
        <circle cx="34" cy="-3" r="5" fill="${P.greenPale}" opacity=".85"/>
        <circle cx="34" cy="-3" r="1.6" fill="${P.wheat}"/>
        <!-- The bin -->
        <path d="M0,8 L64,8 L59,52 L5,52 Z" fill="${P.clayLight}"/>
        <path d="M0,8 L64,8 L62.5,20 L1.5,20 Z" fill="${P.sand}" opacity=".55"/>
        ${[16, 32, 48].map(x => `<rect x="${x}" y="20" width="2.5" height="32" fill="${P.clay}" opacity=".35"/>`).join('')}
      </g>`).join('')}
  </g>

  <!-- ---------- Log stack and sawdust ---------- -->
  <g transform="translate(690,232)">
    ${[[0, 0], [26, 0], [52, 0], [13, -22], [39, -22], [26, -44]].map(([x, y]) => `
      <g transform="translate(${x},${y})">
        <circle cx="12" cy="12" r="12" fill="${P.clay}"/>
        <circle cx="12" cy="12" r="7.5" fill="${P.clayLight}"/>
        <circle cx="12" cy="12" r="3.5" fill="${P.sand}" opacity=".8"/>
      </g>`).join('')}
    <!-- Sawdust pile -->
    <path d="M78,24 C88,4 104,4 114,24 Z" fill="${P.wheat}"/>
    <path d="M84,24 C90,13 98,12 104,24 Z" fill="${P.sand}" opacity=".8"/>
  </g>

  <!-- ---------- Mussel shell sacks ---------- -->
  <g transform="translate(838,246)">
    ${[0, 34, 17].map((dx, i) => `
      <g transform="translate(${dx},${i === 2 ? -26 : 0})">
        <path d="M2,10 C2,2 26,2 26,10 L28,34 L0,34 Z" fill="${P.blue}" opacity=".8"/>
        <path d="M6,14 h16 M5,20 h18 M6,26 h16" stroke="${P.blueLight}" stroke-width="2" opacity=".6"/>
      </g>`).join('')}
  </g>

  <!-- ---------- Collection truck ---------- -->
  <g transform="translate(972,222)">
    <rect x="34" y="6" width="96" height="42" rx="4" fill="${P.greenDark}"/>
    <rect x="42" y="14" width="80" height="12" rx="2" fill="${P.greenLight}" opacity=".45"/>
    <path d="M0,20 L28,20 L28,48 L0,48 Z" fill="${P.green}"/>
    <path d="M4,24 L24,24 L24,36 L4,36 Z" fill="${P.bluePale}" opacity=".9"/>
    <rect x="0" y="46" width="130" height="6" rx="2" fill="${P.ink}" opacity=".25"/>
    <circle cx="20"  cy="54" r="9" fill="${P.ink}" opacity=".8"/>
    <circle cx="20"  cy="54" r="3.5" fill="${P.sand}"/>
    <circle cx="104" cy="54" r="9" fill="${P.ink}" opacity=".8"/>
    <circle cx="104" cy="54" r="3.5" fill="${P.sand}"/>
  </g>

  <!-- Ground shadows. Added last so they sit over the hills but under nothing
       else visually important — without them every object looks like it is
       floating just above the paddock. -->
  <g fill="${P.ink}" opacity=".10">
    <ellipse cx="255" cy="242" rx="118" ry="9"/>   <!-- packhouse -->
    <ellipse cx="432" cy="260" rx="36"  ry="6"/>   <!-- bin 1 -->
    <ellipse cx="514" cy="254" rx="36"  ry="6"/>   <!-- bin 2 -->
    <ellipse cx="596" cy="260" rx="36"  ry="6"/>   <!-- bin 3 -->
    <ellipse cx="726" cy="258" rx="52"  ry="7"/>   <!-- log stack -->
    <ellipse cx="872" cy="282" rx="46"  ry="6"/>   <!-- shell sacks -->
    <ellipse cx="1035" cy="278" rx="70" ry="7"/>   <!-- truck -->
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Category artwork — used as the thumbnail on every listing card
// ---------------------------------------------------------------------------

/**
 * Per-category background art. Sized 320x96 to fill the card thumbnail exactly.
 *
 * Each one is a tinted band plus a simple motif of the material itself, so a
 * wall of listing cards reads as a set rather than as ten unrelated pictures.
 */
const CATEGORY_ART = {
  horticulture: (a, b) => `
    ${band(a, b)}
    <!-- Halved kiwifruit -->
    <g transform="translate(250,48)">
      <circle r="30" fill="${P.greenLight}"/>
      <circle r="24" fill="${P.greenPale}"/>
      <circle r="7" fill="${P.wheat}"/>
      ${ring(12, 10, 2, P.ink, .35)}
    </g>
    <!-- Apple core and peel -->
    <g transform="translate(178,60)">
      <path d="M0,-16 C10,-16 14,-8 12,2 C10,12 4,18 0,18 C-4,18 -10,12 -12,2 C-14,-8 -10,-16 0,-16 Z"
            fill="${P.amber}" opacity=".9"/>
      <path d="M0,-16 C2,-22 8,-24 10,-26" stroke="${P.clay}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
    <!-- Loose skins -->
    ${[[60, 66], [96, 74], [126, 62]].map(([x, y]) =>
      `<path d="M${x},${y} q10,-9 22,-2 q-9,9 -22,2 Z" fill="${P.green}" opacity=".55"/>`).join('')}`,

  dairy: (a, b) => `
    ${band(a, b)}
    <!-- Milk churn -->
    <g transform="translate(240,30)">
      <path d="M8,20 L44,20 L48,66 L4,66 Z" fill="${P.blueLight}"/>
      <rect x="14" y="6" width="24" height="16" rx="3" fill="${P.blue}"/>
      <rect x="4" y="34" width="44" height="5" fill="${P.white}" opacity=".55"/>
    </g>
    <!-- Whey pouring into a settling pond -->
    <path d="M226,52 q-30,14 -66,16 q-40,3 -80,-4" stroke="${P.white}" stroke-width="5"
          fill="none" opacity=".5" stroke-linecap="round"/>
    <ellipse cx="110" cy="76" rx="72" ry="13" fill="${P.white}" opacity=".35"/>
    <ellipse cx="110" cy="74" rx="46" ry="8" fill="${P.white}" opacity=".3"/>`,

  'meat-seafood': (a, b) => `
    ${band(a, b)}
    <!-- Fish frame (skeleton) -->
    <g transform="translate(232,48)">
      <path d="M-52,0 L26,0" stroke="${P.blueLight}" stroke-width="4" stroke-linecap="round"/>
      ${[-42, -30, -18, -6, 6].map(x =>
        `<path d="M${x},-13 L${x + 4},0 L${x},13" stroke="${P.blueLight}" stroke-width="3"
               fill="none" stroke-linecap="round" opacity=".85"/>`).join('')}
      <circle cx="30" cy="-4" r="12" fill="${P.blueLight}" opacity=".9"/>
      <circle cx="34" cy="-6" r="3" fill="${P.ink}" opacity=".6"/>
      <path d="M-52,0 L-70,-14 L-70,14 Z" fill="${P.blueLight}" opacity=".7"/>
    </g>
    <!-- Chilled bin -->
    <path d="M40,52 L120,52 L114,86 L46,86 Z" fill="${P.white}" opacity=".35"/>
    <rect x="40" y="48" width="80" height="7" rx="2" fill="${P.white}" opacity=".5"/>`,

  forestry: (a, b) => `
    ${band(a, b)}
    <!-- Log ends -->
    ${[[196, 62], [232, 62], [214, 34]].map(([x, y]) => `
      <g transform="translate(${x},${y})">
        <circle r="18" fill="${P.clay}"/>
        <circle r="11" fill="${P.clayLight}"/>
        <circle r="5" fill="${P.sand}" opacity=".85"/>
      </g>`).join('')}
    <!-- Sawdust heap -->
    <path d="M56,84 C74,44 116,44 134,84 Z" fill="${P.wheat}"/>
    <path d="M70,84 C82,58 108,58 120,84 Z" fill="${P.sand}" opacity=".8"/>
    ${[[62, 74], [128, 76], [96, 58]].map(([x, y]) =>
      `<rect x="${x}" y="${y}" width="7" height="3" rx="1.5" fill="${P.clay}" opacity=".5"/>`).join('')}`,

  viticulture: (a, b) => `
    ${band(a, b)}
    <!-- Grape bunch -->
    <g transform="translate(240,26)">
      ${[[0, 0], [16, 0], [-16, 0], [8, 14], [-8, 14], [24, 14], [-24, 14], [0, 28], [16, 28], [-16, 28], [8, 42]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${P.blue}" opacity=".85"/>`).join('')}
      <path d="M0,-8 q6,-10 16,-12" stroke="${P.greenDark}" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <!-- Pressed marc heap -->
    <path d="M52,86 C70,50 116,50 134,86 Z" fill="${P.clay}" opacity=".75"/>
    ${[[70, 72], [96, 64], [116, 74]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="4" fill="${P.blue}" opacity=".6"/>`).join('')}`,

  arable: (a, b) => `
    ${band(a, b)}
    <!-- Straw bales -->
    ${[[186, 44], [244, 44]].map(([x, y]) => `
      <g transform="translate(${x},${y})">
        <circle r="26" fill="${P.wheat}"/>
        ${ring(17, 12, 2.5, P.amberDeep, .5)}
        <circle r="8" fill="${P.sand}" opacity=".7"/>
      </g>`).join('')}
    <!-- Wheat stalks -->
    ${[64, 88, 112].map((x, i) => `
      <g transform="translate(${x},${86 - i * 4})">
        <path d="M0,0 L0,-40" stroke="${P.amberDeep}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
        ${[0, 1, 2, 3].map(k => `
          <ellipse cx="${k % 2 ? 5 : -5}" cy="${-16 - k * 7}" rx="4.5" ry="7"
                   fill="${P.wheat}" transform="rotate(${k % 2 ? 25 : -25} ${k % 2 ? 5 : -5} ${-16 - k * 7})"/>`).join('')}
      </g>`).join('')}`,

  aquaculture: (a, b) => `
    ${band(a, b)}
    <!-- Mussel shells -->
    ${[[214, 40, -18], [252, 56, 12], [190, 68, 26]].map(([x, y, r]) => `
      <g transform="translate(${x},${y}) rotate(${r})">
        <path d="M0,0 C4,-20 30,-24 40,-8 C30,8 6,10 0,0 Z" fill="${P.blue}" opacity=".85"/>
        <path d="M6,-2 C12,-14 26,-17 34,-8" stroke="${P.blueLight}" stroke-width="2" fill="none" opacity=".7"/>
      </g>`).join('')}
    <!-- Water lines -->
    ${[[40, 60], [40, 72], [40, 84]].map(([x, y], i) =>
      `<path d="M${x},${y} q18,-6 36,0 t36,0 t36,0" stroke="${P.blueLight}" stroke-width="3"
             fill="none" opacity="${.5 - i * .1}" stroke-linecap="round"/>`).join('')}`,

  'wool-fibre': (a, b) => `
    ${band(a, b)}
    <!-- Sheep -->
    <g transform="translate(226,46)">
      ${[[0, 0], [18, -6], [36, 0], [9, 10], [27, 10]].map(([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="15" fill="${P.paper}" opacity=".92"/>`).join('')}
      <circle cx="48" cy="-6" r="10" fill="${P.slate}"/>
      <circle cx="52" cy="-8" r="2" fill="${P.ink}"/>
      ${[[6, 26], [16, 28], [26, 28], [36, 26]].map(([x, y]) =>
        `<rect x="${x}" y="${y - 4}" width="3.5" height="14" rx="1.75" fill="${P.slate}"/>`).join('')}
    </g>
    <!-- Baled wool -->
    <g transform="translate(56,48)">
      <rect x="0" y="0" width="60" height="42" rx="4" fill="${P.paper}" opacity=".7"/>
      <rect x="0" y="12" width="60" height="4" fill="${P.clay}" opacity=".5"/>
      <rect x="0" y="26" width="60" height="4" fill="${P.clay}" opacity=".5"/>
    </g>`,

  'food-processing': (a, b) => `
    ${band(a, b)}
    <!-- Factory -->
    <g transform="translate(196,26)">
      <rect x="0" y="30" width="96" height="52" fill="${P.slate}" opacity=".55"/>
      ${[[10, 0], [34, 0]].map(([x]) =>
        `<rect x="${x}" y="6" width="16" height="26" fill="${P.slate}" opacity=".7"/>`).join('')}
      ${[[18, -6], [42, -14]].map(([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="9" fill="${P.white}" opacity=".35"/>`).join('')}
      ${[0, 1, 2, 3].map(i =>
        `<rect x="${58 + (i % 2) * 20}" y="${42 + Math.floor(i / 2) * 20}" width="14" height="12"
               rx="1.5" fill="${P.wheat}" opacity=".8"/>`).join('')}
    </g>
    <!-- Peelings on a conveyor -->
    <rect x="34" y="76" width="130" height="7" rx="3.5" fill="${P.ink}" opacity=".25"/>
    ${[[48, 68], [80, 64], [112, 69], [140, 63]].map(([x, y]) =>
      `<path d="M${x},${y} q11,-10 24,-3 q-10,10 -24,3 Z" fill="${P.amber}" opacity=".75"/>`).join('')}`,

  'agri-plastics': (a, b) => `
    ${band(a, b)}
    <!-- Rolls of silage wrap -->
    ${[[204, 52], [248, 40], [232, 74]].map(([x, y]) => `
      <g transform="translate(${x},${y})">
        <ellipse rx="20" ry="20" fill="${P.paper}" opacity=".75"/>
        <ellipse rx="20" ry="20" fill="none" stroke="${P.slate}" stroke-width="2" opacity=".35"/>
        <ellipse rx="7" ry="7" fill="${P.slate}" opacity=".4"/>
      </g>`).join('')}
    <!-- Recycling triangle -->
    <g transform="translate(96,52)" opacity=".8">
      ${[0, 120, 240].map(deg => `
        <g transform="rotate(${deg})">
          <path d="M-14,-8 L0,-30 L14,-8 Z" fill="${P.green}" opacity=".85"/>
        </g>`).join('')}
    </g>`
};

/** A soft two-tone background band, shared by every category illustration. */
function band(a, b) {
  return `<rect width="320" height="96" fill="url(#g_${a.replace('#', '')}_${b.replace('#', '')})"/>`;
}

/** Evenly spaced radial ticks — used for kiwifruit seeds and bale twine. */
function ring(radius, count, size, colour, opacity) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return `<circle cx="${(Math.cos(angle) * radius).toFixed(1)}" cy="${(Math.sin(angle) * radius).toFixed(1)}"
                    r="${size}" fill="${colour}" opacity="${opacity}"/>`;
  }).join('');
}

/** Background gradient pair for each category. */
const CATEGORY_TONES = {
  horticulture: ['#dff0e2', '#bfe3c9'],
  dairy: ['#dfeaf6', '#c2d9ee'],
  'meat-seafood': ['#d8e7f0', '#b6d2e3'],
  forestry: ['#e8e2d2', '#d5c8ac'],
  viticulture: ['#e4dcee', '#cabee0'],
  arable: ['#f2e8cd', '#e6d6a8'],
  aquaculture: ['#d9eaee', '#b8d9e2'],
  'wool-fibre': ['#ece7e0', '#dad2c6'],
  'food-processing': ['#e6e6e2', '#d2d2cc'],
  'agri-plastics': ['#dfeee9', '#c2e0d6']
};

/**
 * Return the SVG for a category's thumbnail.
 * Falls back to a plain band for any category without bespoke art.
 *
 * @param {string} categoryId
 * @param {object} [opts]
 * @param {'centre'|'motif'} [opts.crop]
 *   The canvas is 320x96 (wide). In a narrow container the browser has to crop
 *   horizontally, and every motif in this set is drawn on the RIGHT of the
 *   canvas — so a centre crop slices the subject off. Pass `crop: 'motif'` for
 *   narrow containers (the home page category tiles) to anchor the crop right
 *   and keep the illustration's subject in frame.
 */
export function categoryArt(categoryId, { crop = 'centre' } = {}) {
  const [a, b] = CATEGORY_TONES[categoryId] || ['#e6eae4', '#d2d9cf'];
  const draw = CATEGORY_ART[categoryId];
  const gradientId = `g_${a.replace('#', '')}_${b.replace('#', '')}`;
  const align = crop === 'motif' ? 'xMaxYMid' : 'xMidYMid';

  return `
<svg viewBox="0 0 320 96" preserveAspectRatio="${align} slice" aria-hidden="true">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="100%" stop-color="${b}"/>
    </linearGradient>
  </defs>
  ${draw ? draw(a, b) : band(a, b)}
</svg>`;
}

// ---------------------------------------------------------------------------
// Spot illustrations for the "how it works" steps
// ---------------------------------------------------------------------------

/** Three small square illustrations, one per step on the home page. */
export function stepArt(step) {
  const art = {
    1: `
      <!-- A listing form being filled in -->
      <rect x="14" y="10" width="52" height="60" rx="6" fill="${P.paper}" stroke="${P.greenDark}" stroke-width="2.5"/>
      <rect x="22" y="20" width="30" height="4" rx="2" fill="${P.greenDark}" opacity=".55"/>
      <rect x="22" y="30" width="36" height="4" rx="2" fill="${P.slate}" opacity=".35"/>
      <rect x="22" y="40" width="24" height="4" rx="2" fill="${P.slate}" opacity=".35"/>
      <rect x="22" y="52" width="22" height="9" rx="4.5" fill="${P.amber}"/>
      <circle cx="60" cy="60" r="14" fill="${P.green}"/>
      <path d="M54,60 l4,4 l8,-9" stroke="${P.white}" stroke-width="3" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>`,
    2: `
      <!-- Two nodes being matched by the AI -->
      <circle cx="20" cy="26" r="12" fill="${P.amber}"/>
      <circle cx="60" cy="54" r="12" fill="${P.green}"/>
      <path d="M28,32 C40,38 44,42 52,48" stroke="${P.greenDark}" stroke-width="3"
            stroke-dasharray="5 5" fill="none" stroke-linecap="round"/>
      <g transform="translate(56,20)">
        <path d="M0,-11 L3,-3 L11,0 L3,3 L0,11 L-3,3 L-11,0 L-3,-3 Z" fill="${P.greenDark}"/>
      </g>
      <path d="M14,64 h20 M14,72 h32" stroke="${P.slate}" stroke-width="3"
            opacity=".3" stroke-linecap="round"/>`,
    3: `
      <!-- A truck collecting, with the loop arrow -->
      <rect x="26" y="34" width="42" height="24" rx="3" fill="${P.greenDark}"/>
      <path d="M8,42 L24,42 L24,58 L8,58 Z" fill="${P.green}"/>
      <rect x="6" y="57" width="64" height="4" rx="2" fill="${P.ink}" opacity=".25"/>
      <circle cx="20" cy="63" r="6" fill="${P.ink}" opacity=".75"/>
      <circle cx="56" cy="63" r="6" fill="${P.ink}" opacity=".75"/>
      <!-- The recycling loop, drawn as a dashed circle rather than an arc:
           an A-command arc can easily extend past the 80x80 viewBox and get
           clipped, whereas a circle's bounds are exactly cx±(r + stroke). -->
      <circle cx="40" cy="21" r="13" fill="none" stroke="${P.amber}" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="56 26" transform="rotate(-105 40 21)"/>
      <path d="M49,12 L59,18 L48,24 Z" fill="${P.amber}"/>`
  }[step] || '';

  return `<svg viewBox="0 0 80 80" aria-hidden="true">${art}</svg>`;
}

// ---------------------------------------------------------------------------
// Empty-state artwork
// ---------------------------------------------------------------------------

/** A friendlier illustration than an emoji for "nothing here yet" states. */
export function emptyArt() {
  return `
<svg viewBox="0 0 120 90" aria-hidden="true">
  <ellipse cx="60" cy="80" rx="40" ry="6" fill="${P.slate}" opacity=".15"/>
  <path d="M28,30 L92,30 L84,74 L36,74 Z" fill="${P.sand}" opacity=".7"/>
  <path d="M28,30 L92,30 L90.5,38 L29.5,38 Z" fill="${P.clayLight}" opacity=".6"/>
  ${[44, 60, 76].map(x => `<rect x="${x}" y="38" width="2.5" height="36" fill="${P.clay}" opacity=".3"/>`).join('')}
  <circle cx="60" cy="18" r="13" fill="none" stroke="${P.green}" stroke-width="3.5" opacity=".8"/>
  <path d="M70,28 L82,40" stroke="${P.green}" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>
</svg>`;
}
