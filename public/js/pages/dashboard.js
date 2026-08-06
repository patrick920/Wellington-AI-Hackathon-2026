/**
 * pages/dashboard.js
 * ------------------
 * "Your account" — everything belonging to the demo user in one place:
 * their listings, saved matches, wanted posts, and the enquiries flowing
 * in and out.
 *
 * Accepting an enquiry here is what converts a match into a completed deal,
 * which is what feeds the realised numbers on the Impact page. That loop is
 * worth demonstrating live in the pitch.
 */

import { h, render, num, money, tonnes, timeAgo, toast, loadingBlock, emptyBlock } from '../utils.js';
import { api } from '../api.js';
import { listingCard, openListingDrawer } from '../components.js';
import { sendMessage } from '../chat.js';
import { emptyArt } from '../illustrations.js';

export const dashboardPage = {
  async render(container) {
    render(container, h('div', { class: 'page' }, loadingBlock('Loading your dashboard…')));

    const me = await api.me();

    // Total impact attributable to this user's completed deals.
    const myImpact = me.deals.reduce((acc, d) => ({
      tonnes: acc.tonnes + d.tonnes,
      co2: acc.co2 + d.co2Saved,
      money: acc.money + d.moneySaved
    }), { tonnes: 0, co2: 0, money: 0 });

    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'Your account'),
          h('h1', { style: { fontSize: '2rem' } }, 'Dashboard'),
          h('p', { class: 'lede' }, 'Your listings, your shortlist, and every enquiry in flight.')
        ),

        // --- Personal impact tiles ------------------------------------------
        h('div', { class: 'stat-grid', style: { marginBottom: '2rem' } },
          h('div', { class: 'stat' },
            h('div', { class: 'stat-label' }, 'Your listings'),
            h('div', { class: 'stat-value' }, num(me.myListings.length)),
            h('div', { class: 'stat-unit' }, 'published')),
          h('div', { class: 'stat blue' },
            h('div', { class: 'stat-label' }, 'Shortlisted'),
            h('div', { class: 'stat-value' }, num(me.savedListings.length)),
            h('div', { class: 'stat-unit' }, 'saved matches')),
          h('div', { class: 'stat amber' },
            h('div', { class: 'stat-label' }, 'Enquiries'),
            h('div', { class: 'stat-value' }, num(me.requests.length)),
            h('div', { class: 'stat-unit' }, `${me.requests.filter(r => r.status === 'pending').length} awaiting a decision`)),
          h('div', { class: 'stat clay' },
            h('div', { class: 'stat-label' }, 'Diverted on platform'),
            h('div', { class: 'stat-value' }, num(myImpact.tonnes)),
            h('div', { class: 'stat-unit' }, `tonnes · ${num(myImpact.co2)} t CO₂e · ${money(myImpact.money)} saved`))
        ),

        // --- Enquiries -------------------------------------------------------
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('h2', {}, 'Enquiries'),
            h('span', { class: 'small muted' }, 'Accept one to record the diversion')
          ),
          me.requests.length
            ? h('div', { class: 'card card-pad' },
                ...me.requests.map(r => requestRow(r, container)))
            : emptyBlock('📨', 'No enquiries yet',
                'When someone enquires about your listing — or when you enquire about theirs — it appears here.')
        ),

        // --- Two-column: my listings / saved ---------------------------------
        h('div', { class: 'dash-grid' },
          h('section', {},
            h('div', { class: 'section-head' },
              h('h2', {}, 'Your listings'),
              h('a', { class: 'btn btn-primary btn-sm', href: '#/list-waste' }, '+ New listing')
            ),
            me.myListings.length
              ? h('div', { class: 'stack' }, ...me.myListings.map(l => listingCard(l)))
              : emptyBlock(emptyArt(), 'Nothing listed yet',
                  'List a waste stream and the matcher will start looking for takers immediately.',
                  h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '.8rem' } },
                    h('a', { class: 'btn btn-primary', href: '#/list-waste' }, 'List your waste'),
                    h('button', {
                      class: 'btn btn-secondary',
                      onclick: () => sendMessage('I want to list a waste stream on Waste Opportunities. Ask me what you need to know and then fill in the form for me.')
                    }, '✦ Have the AI Assistant do it')
                  ))
          ),

          h('section', {},
            h('div', { class: 'section-head' },
              h('h2', {}, 'Your shortlist'),
              h('a', { class: 'btn btn-ghost btn-sm', href: '#/match' }, 'Find more →')
            ),
            me.savedListings.length
              ? h('div', { class: 'stack' }, ...me.savedListings.map(l => listingCard(l)))
              : emptyBlock('♥', 'Nothing saved',
                  'Swipe right on the Match page to build a shortlist of material worth chasing.',
                  h('a', { class: 'btn btn-primary', href: '#/match', style: { marginTop: '.8rem' } }, 'Open the matcher'))
          )
        ),

        // --- Wanted posts ------------------------------------------------------
        me.myWants.length
          ? h('section', { class: 'section', style: { marginTop: '2rem' } },
              h('h2', {}, 'Your wanted requests'),
              h('div', { class: 'stack' },
                ...me.myWants.map(w =>
                  h('div', { class: 'card card-pad' },
                    h('strong', {}, w.title),
                    h('p', { class: 'small muted', style: { margin: '.3rem 0 0' } }, w.description),
                    h('div', { class: 'small muted' }, `${w.region} · ${timeAgo(w.createdAt)}`)
                  )))
            )
          : null,

        // --- Recent platform deals -----------------------------------------------
        h('section', { class: 'section', style: { marginTop: '2rem' } },
          h('h2', {}, 'Recent activity across Waste Opportunities'),
          h('div', { class: 'card card-pad table-wrap' },
            h('table', { class: 'table' },
              h('thead', {}, h('tr', {},
                h('th', {}, 'Material'), h('th', {}, 'Matched with'), h('th', {}, 'Tonnes'), h('th', {}, 'When'))),
              h('tbody', {},
                ...me.deals.map(d => h('tr', {},
                  h('td', {}, d.listingTitle),
                  h('td', {}, d.buyer),
                  h('td', {}, tonnes(d.tonnes)),
                  h('td', { class: 'muted' }, timeAgo(d.completedAt))
                )))
            ))
        )
      )
    );
  }
};

/** One enquiry row, with accept/view controls. */
function requestRow(req, container) {
  const statusBadge = {
    pending: h('span', { class: 'badge badge-amber' }, 'Pending'),
    accepted: h('span', { class: 'badge badge-green' }, 'Accepted'),
    declined: h('span', { class: 'badge badge-danger' }, 'Declined')
  }[req.status] || h('span', { class: 'badge' }, req.status);

  return h('div', { class: 'req-item' },
    h('div', { class: 'spread' },
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 'row', style: { marginBottom: '.25rem' } },
          statusBadge,
          h('strong', {}, req.listingTitle)
        ),
        h('div', { class: 'small muted' },
          `From ${req.fromName}${req.fromOrg ? ` · ${req.fromOrg}` : ''} · ${timeAgo(req.createdAt)}`),
        req.message ? h('p', { class: 'small', style: { margin: '.4rem 0 0' } }, `"${req.message}"`) : null
      ),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn-secondary btn-sm',
          onclick: () => openListingDrawer(req.listingId)
        }, 'View listing'),
        req.status === 'pending'
          ? h('button', {
              class: 'btn btn-primary btn-sm',
              onclick: async () => {
                await api.acceptRequest(req.id);
                toast('Match confirmed — diversion recorded on the Impact page', 'success');
                dashboardPage.render(container);
              }
            }, 'Accept match')
          : null
      )
    )
  );
}
