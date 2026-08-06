/**
 * pages/wanted.js
 * ---------------
 * The reverse marketplace: people advertising what they NEED.
 *
 * This matters because it lets a waste producer see demand before they list,
 * and it gives the AI something to point at when someone asks "who would
 * actually want my mussel shell?".
 */

import { h, render, timeAgo, toast, loadingBlock } from '../utils.js';
import { api } from '../api.js';
import { state, categoryById } from '../state.js';
import { sendMessage } from '../chat.js';

export const wantedPage = {
  async render(container) {
    render(container, h('div', { class: 'page' }, loadingBlock('Loading requests…')));

    const { wants } = await api.wants();

    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'Reverse marketplace'),
          h('h1', { style: { fontSize: '2rem' } }, 'Wanted'),
          h('p', { class: 'lede' },
            'People actively looking for material. If you produce something on this list, you have a buyer waiting — ' +
            'and if what you need is not here, post it so producers can find you.')
        ),

        h('div', { class: 'listing-grid', style: { marginBottom: '2rem' } },
          ...wants.map(wantCard)),

        wantForm(container)
      )
    );
  }
};

/** One "wanted" card. */
function wantCard(want) {
  const cat = categoryById(want.category);
  return h('article', { class: 'card card-pad' },
    h('div', { class: 'row', style: { marginBottom: '.5rem' } },
      h('span', { class: 'badge' }, `${cat.icon} ${cat.label}`),
      h('span', { class: 'badge' }, `📍 ${want.region}`),
      want.ownerId === 'me' ? h('span', { class: 'badge badge-green' }, 'Yours') : null
    ),
    h('h3', { style: { marginBottom: '.35rem' } }, want.title),
    h('p', { class: 'small muted' }, want.description),
    h('div', { class: 'spread', style: { marginTop: '.6rem' } },
      h('div', { class: 'small' },
        h('strong', {}, want.org || 'Anonymous'),
        want.quantityNeeded ? h('div', { class: 'muted' }, `Needs ${want.quantityNeeded}`) : null,
        h('div', { class: 'muted' }, timeAgo(want.createdAt))
      ),
      h('button', {
        class: 'btn btn-secondary btn-sm',
        onclick: () => sendMessage(
          `Someone on Waste Opportunities wants: "${want.title}" — ${want.description} (${want.region}). ` +
          `Search the marketplace and tell me which existing listings could satisfy this, and what is missing.`)
      }, '✦ Find them a match')
    )
  );
}

/** The form for posting your own wanted request. */
function wantForm(container) {
  const title = h('input', { type: 'text', required: true, placeholder: 'e.g. Seeking hard shell for a crushing trial' });
  const description = h('textarea', { rows: '3', required: true, placeholder: 'What is it for, what quality do you need, and how would you collect it?' });
  const category = h('select', {},
    h('option', { value: '' }, 'Any industry'),
    ...(state.meta?.categories || []).map(c => h('option', { value: c.id }, `${c.icon} ${c.label}`))
  );
  const region = h('select', {},
    ...(state.meta?.regions || []).map(r => h('option', { value: r.name, selected: r.name === state.myRegion }, r.name))
  );
  const quantityNeeded = h('input', { type: 'text', placeholder: 'e.g. 5-10 tonnes per month' });
  const org = h('input', { type: 'text', placeholder: 'Your organisation' });

  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Post request');

  return h('form', {
    class: 'card card-pad',
    onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true;
      try {
        await api.createWant({
          title: title.value, description: description.value,
          category: category.value, region: region.value,
          quantityNeeded: quantityNeeded.value, org: org.value
        });
        toast('Your request is posted', 'success');
        wantedPage.render(container);
      } catch (err) {
        toast(err.message, 'warn');
        btn.disabled = false;
      }
    }
  },
    h('h3', {}, 'Post what you are looking for'),
    h('p', { class: 'small muted' },
      'Producers browse this list before they decide whether something is worth separating out.'),
    h('div', { class: 'field' }, h('label', {}, 'Title'), title),
    h('div', { class: 'field' }, h('label', {}, 'What you need and why'), description),
    h('div', { class: 'field-row' },
      h('div', { class: 'field' }, h('label', {}, 'Industry'), category),
      h('div', { class: 'field' }, h('label', {}, 'Region'), region),
      h('div', { class: 'field' }, h('label', {}, 'Quantity needed'), quantityNeeded),
      h('div', { class: 'field' }, h('label', {}, 'Organisation'), org)
    ),
    h('div', { class: 'row' },
      btn,
      h('button', {
        class: 'btn btn-ghost', type: 'button',
        onclick: () => sendMessage("I want to post a wanted request on Waste Opportunities but I'm not sure how to describe what I need. Ask me questions and then write it for me.")
      }, '✦ Help me write it')
    )
  );
}
