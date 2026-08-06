/**
 * pages/listWaste.js
 * ------------------
 * The form a waste producer fills in.
 *
 * Two things make this more than a plain form:
 *   1. The AI can pre-fill it (state.prefill), so a producer can just describe
 *      their situation in the chat and arrive here with everything filled in.
 *   2. A live "impact preview" recalculates as they type, so they can see the
 *      tonnage, CO2e and disposal cost they are putting on the table.
 */

import { h, render, num, money, toast } from '../utils.js';
import { api } from '../api.js';
import { state, setState } from '../state.js';
import { navigate } from '../router.js';
import { sendMessage } from '../chat.js';

export const listWastePage = {
  render(container) {
    // Values the AI may have pre-filled for us.
    // We consume them once and clear the slot by direct assignment rather than
    // setState — this render is already in progress, so notifying subscribers
    // here would just cause a redundant second render.
    const pre = state.prefill || {};
    const wasPrefilledByAi = Boolean(state.prefill);
    state.prefill = null;

    // ---- Field elements -------------------------------------------------
    const f = {
      title: h('input', { type: 'text', required: true, value: pre.title || '', placeholder: 'e.g. Kiwifruit skin and pomace from packhouse grading' }),
      wasteType: h('input', { type: 'text', value: pre.wasteType || '', placeholder: 'e.g. Kiwifruit pomace' }),
      category: select(state.meta?.categories?.map(c => [c.id, `${c.icon} ${c.label}`]) || [], pre.category),
      description: h('textarea', { rows: '4', value: pre.description || '', placeholder: 'What exactly is it? How is it produced? Is it contaminated with anything? How would someone collect it?' }),
      quantityAmount: h('input', { type: 'number', min: '0', step: 'any', required: true, value: pre.quantityAmount ?? '', placeholder: '40' }),
      quantityUnit: select((state.meta?.units || []).map(u => [u, u]), pre.quantityUnit || 'tonnes'),
      quantityFrequency: select((state.meta?.frequencies || []).map(x => [x, x]), pre.quantityFrequency || 'weekly'),
      region: select((state.meta?.regions || []).map(r => [r.name, r.name]), pre.region || state.myRegion),
      city: h('input', { type: 'text', value: pre.city || '', placeholder: 'Town or suburb' }),
      shelfLifeDays: h('input', { type: 'number', min: '0', value: pre.shelfLifeDays ?? 14, placeholder: '7' }),
      condition: select([['fresh', 'Fresh / wet'], ['chilled', 'Chilled'], ['frozen', 'Frozen'], ['dry', 'Dry'], ['liquid', 'Liquid'], ['processed', 'Processed / stable'], ['mixed', 'Mixed']], pre.condition || 'fresh'),
      price: h('input', { type: 'number', min: '0', step: 'any', value: pre.price ?? 0 }),
      co2PerTonne: h('input', { type: 'number', min: '0', step: '0.01', value: 0.6 }),
      disposalCostPerTonne: h('input', { type: 'number', min: '0', step: '1', value: 150 }),
      org: h('input', { type: 'text', placeholder: 'Your business name' }),
      contactName: h('input', { type: 'text', placeholder: 'Contact person' }),
      email: h('input', { type: 'email', placeholder: 'you@example.co.nz' }),
      phone: h('input', { type: 'tel', placeholder: '07 555 0100' })
    };

    // ---- Impact preview, recalculated on every change --------------------
    const preview = h('div', { class: 'stat-grid' });
    const updatePreview = () => {
      const unitToTonnes = { tonnes: 1, kg: 0.001, 'cubic metres': 0.4, litres: 0.001, bales: 0.25, pallets: 0.5 };
      const perYear = { 'one-off': 1, daily: 250, weekly: 52, fortnightly: 26, monthly: 12, seasonal: 3 };
      const amount = Number(f.quantityAmount.value) || 0;
      const t = amount * (unitToTonnes[f.quantityUnit.value] ?? 1);
      const annual = t * (perYear[f.quantityFrequency.value] ?? 1);
      const co2 = annual * (Number(f.co2PerTonne.value) || 0.6);
      const cash = annual * (Number(f.disposalCostPerTonne.value) || 150);

      preview.replaceChildren(
        stat('Per year', `${num(annual)}`, 'tonnes diverted'),
        stat('CO₂e avoided', `${num(co2)}`, 'tonnes per year', 'amber'),
        stat('Disposal cost avoided', money(cash), 'per year', 'clay')
      );
    };
    ['input', 'change'].forEach(evt => {
      [f.quantityAmount, f.quantityUnit, f.quantityFrequency, f.co2PerTonne, f.disposalCostPerTonne]
        .forEach(el => el.addEventListener(evt, updatePreview));
    });

    // ---- Price type and visibility (segmented controls) -------------------
    const priceType = segmented('priceType', [
      ['free', 'Free to collect'],
      ['pay-to-take', 'I will pay for removal'],
      ['negotiable', 'Negotiable'],
      ['paid', 'For sale']
    ], pre.priceType || 'free');

    const visibility = segmented('visibility', [
      ['public', '🌐 Public — anyone can see it'],
      ['private', '🔒 Private — only strong AI matches']
    ], pre.visibility || 'public');

    // ---- Submit ----------------------------------------------------------
    const submitBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Publish listing');

    const form = h('form', {
      onsubmit: async e => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publishing…';
        try {
          const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
          body.priceType = priceType.value();
          body.visibility = visibility.value();
          body.suggestedUses = pre.suggestedUses || [];
          await api.createListing(body);
          toast('Your listing is live', 'success');
          navigate('dashboard');
        } catch (err) {
          toast(`Could not publish: ${err.message}`, 'warn');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish listing';
        }
      }
    },
      // ---- Section: what is it -------------------------------------------
      card('1. What is the material?',
        field('Listing title', f.title, 'A short, specific headline. This is what people search.'),
        h('div', { class: 'field-row' },
          field('Material name', f.wasteType, 'The generic name, e.g. "grape marc".'),
          field('Industry', f.category)
        ),
        field('Description', f.description,
          'Be honest about contamination and handling — it saves everyone a wasted trip.')
      ),

      // ---- Section: how much ---------------------------------------------
      card('2. How much, and how often?',
        h('div', { class: 'field-row' },
          field('Amount', f.quantityAmount),
          field('Unit', f.quantityUnit),
          field('How often', f.quantityFrequency)
        ),
        h('div', { class: 'field-row' },
          field('Condition', f.condition),
          field('Shelf life (days)', f.shelfLifeDays,
            'The single most important field. How long before it spoils or loses value?')
        )
      ),

      // ---- Section: where -------------------------------------------------
      card('3. Where is it?',
        h('div', { class: 'field-row' },
          field('Region', f.region),
          field('Town / suburb', f.city)
        ),
        h('div', { class: 'field' },
          h('label', {}, 'Who can see this listing?'),
          visibility.el,
          h('div', { class: 'hint' },
            'Private listings stay out of Browse. The AI matcher can still reveal them — but only to someone whose ' +
            'need scores as a genuinely strong match. Useful if you would rather your competitors did not know your volumes.')
        )
      ),

      // ---- Section: price -------------------------------------------------
      card('4. Price',
        h('div', { class: 'field' },
          h('label', {}, 'How do you want to handle cost?'),
          priceType.el,
          h('div', { class: 'hint' },
            'If you currently pay to landfill this, "I will pay for removal" is often still much cheaper for you — and it makes the listing far more attractive.')
        ),
        h('div', { class: 'field-row' },
          field('Amount (NZD per tonne)', f.price),
          field('CO₂e avoided per tonne', f.co2PerTonne, 'Tonnes of CO₂e saved per tonne diverted. 0.6 is a reasonable default for wet organics.'),
          field('Current disposal cost per tonne', f.disposalCostPerTonne, 'What you pay now to get rid of it.')
        )
      ),

      // ---- Section: contact ------------------------------------------------
      card('5. Contact details',
        h('div', { class: 'field-row' },
          field('Organisation', f.org),
          field('Contact name', f.contactName)
        ),
        h('div', { class: 'field-row' },
          field('Email', f.email),
          field('Phone', f.phone)
        )
      ),

      h('div', { class: 'row', style: { marginTop: '1.4rem' } },
        submitBtn,
        h('button', {
          class: 'btn btn-secondary', type: 'button',
          onclick: () => sendMessage(
            `I'm filling in the LoopNZ listing form for "${f.title.value || 'a waste stream'}". ` +
            `It's ${f.quantityAmount.value || '?'} ${f.quantityUnit.value} ${f.quantityFrequency.value} in ${f.region.value}. ` +
            `Suggest realistic uses, a sensible shelf life, and whether I should price it free, negotiable or pay-to-take.`)
        }, '✦ Ask Kōwhai to help fill this in')
      )
    );

    // ---- Page shell --------------------------------------------------------
    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'For producers'),
          h('h1', { style: { fontSize: '2rem' } }, 'List your waste'),
          h('p', { class: 'lede' },
            'Takes about a minute. The more precise you are about quantity, location and shelf life, the better the ' +
            'matcher can work — those three fields decide whether a collection is physically possible.')
        ),

        wasPrefilledByAi
          ? h('div', {
              class: 'card card-pad',
              style: { marginBottom: '1.2rem', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
            }, h('strong', {}, '✦ Kōwhai filled this in for you.'), ' Check every field before publishing.')
          : null,

        h('div', { class: 'card card-pad', style: { marginBottom: '1.4rem' } },
          h('h3', {}, 'Impact preview'),
          h('p', { class: 'small muted' }, 'Updates as you type — this is what you are putting on the table.'),
          preview
        ),

        form
      )
    );

    updatePreview();
  }
};

// --- little builders --------------------------------------------------------

function card(title, ...children) {
  return h('section', { class: 'card card-pad', style: { marginBottom: '1rem' } },
    h('h3', { style: { marginBottom: '.9rem' } }, title),
    ...children
  );
}

function field(label, input, hint) {
  return h('div', { class: 'field' },
    h('label', {}, label),
    input,
    hint ? h('div', { class: 'hint' }, hint) : null
  );
}

function select(options, selected) {
  return h('select', {},
    ...options.map(([value, label]) =>
      h('option', { value, selected: String(value) === String(selected) }, label))
  );
}

/**
 * A segmented radio control. Returns { el, value() } so the caller can read
 * the chosen value at submit time.
 */
function segmented(name, options, initial) {
  const inputs = options.map(([value, label], i) => {
    const id = `${name}_${i}`;
    const input = h('input', { type: 'radio', name, id, value, checked: value === initial });
    return [input, h('label', { for: id }, label)];
  });
  const el = h('div', { class: 'segmented' }, ...inputs.flat());
  return {
    el,
    value: () => el.querySelector('input:checked')?.value || initial
  };
}

function stat(label, value, unit, tone = '') {
  return h('div', { class: `stat ${tone}` },
    h('div', { class: 'stat-label' }, label),
    h('div', { class: 'stat-value' }, value),
    h('div', { class: 'stat-unit' }, unit)
  );
}
