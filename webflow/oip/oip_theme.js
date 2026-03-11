/**
 * OIP Theme — Monday.com-inspired Board View
 * Inject: Site Settings → Custom Code → Before </body>
 * Wrap in: <script> ... </script>
 *
 * Fetches all opportunities from the API webhook, then builds a
 * grouped table board with filters, stats, and sort.
 * Falls back to reading Webflow CMS DOM elements if API is unavailable.
 */
(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────── */
  var API_URL = 'https://n8n.ifmm.com/webhook/oip-opportunities';

  /* ── Stage config ────────────────────────────────────────── */
  var STAGES_ORDER = [
    'Discovered', 'Initial Qualification', 'Bid/No-Bid Review',
    'Solution Design', 'Solution Approval', 'Proposal Development',
    'Internal Review', 'Submitted', 'Awarded', 'Lost', 'Archived'
  ];
  var STAGE_COLORS = {
    'Discovered': '#579bfc',
    'Initial Qualification': '#a25ddc',
    'Bid/No-Bid Review': '#fdab3d',
    'Solution Design': '#7e3af2',
    'Solution Approval': '#ff007f',
    'Proposal Development': '#00c875',
    'Internal Review': '#225091',
    'Submitted': '#00d2d2',
    'Awarded': '#037f4c',
    'Lost': '#e2445c',
    'Archived': '#c4c4c4'
  };
  var STAGE_CSS = {
    'Discovered': 'discovered',
    'Initial Qualification': 'initial-qualification',
    'Bid/No-Bid Review': 'bid-review',
    'Solution Design': 'solution-design',
    'Solution Approval': 'solution-approval',
    'Proposal Development': 'proposal-dev',
    'Internal Review': 'internal-review',
    'Submitted': 'submitted',
    'Awarded': 'awarded',
    'Lost': 'lost',
    'Archived': 'archived'
  };
  var BUYER_CSS = {
    'Federal': 'federal', 'State': 'state', 'Local': 'local',
    'Quasi-Public': 'quasi-public', 'Private': 'private'
  };
  var ACTIVE_STAGES = [
    'Discovered', 'Initial Qualification', 'Bid/No-Bid Review',
    'Solution Design', 'Solution Approval', 'Proposal Development'
  ];

  /* ── Reverse option maps (Webflow hex ID → display name) ── */
  var STAGE_IDS = {
    '178c5ad93e4b87fc67f9ad497de0a0c1': 'Discovered',
    '356c258e17945268324b7175d2238285': 'Initial Qualification',
    '208086e598c5f13be1007008bc1bd442': 'Bid/No-Bid Review',
    '98d7b579738069478f1ae00f8aa8f3f3': 'Solution Design',
    '095ccecb72a6ecd3577a6a2e322131fc': 'Solution Approval',
    'b8b3f1efc4b45ec5a227e834b0a7d891': 'Proposal Development',
    'e71de3a3ac709a9c40f499a48a373176': 'Internal Review',
    '960cb3cc71d59d7a009c324b74400510': 'Submitted',
    '8365382e5aae32cf7e01909f0de46e7d': 'Awarded',
    '56a23f60a3f03b3a56f4960a8d4eaff0': 'Lost',
    'cdbf97871a61b6c4ad174c6fcd501ef4': 'Archived'
  };
  var SOURCE_IDS = {
    '2b4dce1bd9ea17f50aac656dd10f4b05': 'SAM.gov',
    '14781c98fa19f89844c652759dcb593d': 'eVA',
    'adb6fd7d8186b49e417156a5b0ca77b0': 'eMaryland',
    '7846a47eb0e3af84303a8c27c75a8b9f': 'DC OCP',
    '67137cd439a5e0bbbf470ade5d04a757': 'Cal eProcure',
    'c83cf8da35b92e0116531ca8e7bf4cbf': 'NYS Contract Reporter',
    'a2ac878e347bd848ce61680d6306bf28': 'TX ESBD',
    'f4d8b43c1cffacd1e412c528e76bdc9e': 'University',
    '0ec722289336a2011988d4dcb22485db': 'Transit Authority',
    'e4f27fac1713bd08bc42929c6d6c55b0': 'Private Sector',
    'c0939d2d5eb0b67bf723931a8498057b': 'Other',
    'ad785c94ca76d0deaa800e8fcc456f66': 'OpenGov',
    '6d2a4d1c4be828dd2dcb21abda2dc964': 'BidPrime'
  };
  var BUYER_TYPE_IDS = {
    '7e3dc1b3385bc640862f27a46c75f4d2': 'Federal',
    'e05c94d4366c7307a586f04def5a09ec': 'State',
    'aea7a0930c58b8e5761e6696906978bc': 'Local',
    '2970cf2231ecdb929030921807db1411': 'Quasi-Public',
    '2ac72404472e0b198e3541e86360a119': 'Private'
  };
  var BID_DECISION_IDS = {
    '7ec0f94a52b9662cc078ad18eaf16bb2': 'Bid',
    'e196700a9cc0cada0f5cadabffbe5176': 'No-Bid',
    'a6c3f8b6ee307e3a3168d51e8a168da7': 'Conditional'
  };

  /* ── SVG icons ───────────────────────────────────────────── */
  var ICON_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/></svg>';
  var ICON_CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
  var ICON_EXTLINK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="M8 2h4v4"/><path d="M6 8L12 2"/></svg>';

  /* ── Data ───────────────────────────────────────────────── */
  var items = [];

  function mapApiItem(wfItem) {
    var fd = wfItem.fieldData || {};
    return {
      el: null,
      name: fd.name || 'Untitled',
      stage: STAGE_IDS[fd.stage] || fd.stage || '',
      source: SOURCE_IDS[fd.source] || fd.source || '',
      buyerType: BUYER_TYPE_IDS[fd['buyer-type']] || fd['buyer-type'] || '',
      score: parseInt(fd['bid-readiness-score'], 10) || 0,
      deadline: fd['submission-deadline'] || '',
      slug: fd.slug ? '/opportunities/' + fd.slug : '#',
      sourceUrl: fd['source-url'] || '',
      buyerName: fd['buyer-name'] || '',
      fee: fd['estimated-fee'] || '',
      bidDecision: BID_DECISION_IDS[fd['bid-decision']] || fd['bid-decision'] || ''
    };
  }

  function extractItemsFromDom() {
    var cards = document.querySelectorAll('[data-oip="card"]');
    if (!cards.length) cards = document.querySelectorAll('.w-dyn-item [data-oip="card"], .w-dyn-item a');
    if (!cards.length) cards = document.querySelectorAll('.oip-card');
    if (!cards.length) return [];

    var arr = [];
    cards.forEach(function (card) {
      var wrapper = card.closest('.w-dyn-item') || card.parentElement;
      var scope = wrapper || card;

      function read(attrName, className) {
        var val = card.getAttribute(attrName);
        if (val && val.length < 40 && !/^[0-9a-f]{20,}$/i.test(val)) return val.trim();
        var el = scope.querySelector('.' + className);
        if (el) return el.textContent.trim();
        return '';
      }

      var data = {
        el: wrapper,
        name: read('data-name', 'oip-name') || card.querySelector('.oip-card-title, h3, .oip-name')?.textContent?.trim() || 'Untitled',
        stage: read('data-stage', 'oip-stage'),
        source: read('data-source', 'oip-src'),
        buyerType: read('data-buyer-type', 'oip-bt'),
        score: parseInt(read('data-score', 'oip-score'), 10) || 0,
        deadline: read('data-deadline', 'oip-dl'),
        slug: card.getAttribute('href') || card.closest('a')?.getAttribute('href') || '#',
        sourceUrl: read('data-source-url', 'oip-src-url'),
        buyerName: '',
        fee: '',
        bidDecision: ''
      };

      scope.querySelectorAll('[data-field]').forEach(function (f) {
        var key = f.getAttribute('data-field');
        var val = f.textContent.trim();
        if (key === 'buyer-name') data.buyerName = val;
        if (key === 'fee') data.fee = val;
        if (key === 'bid-decision') data.bidDecision = val;
      });

      var bn = scope.querySelector('.oip-buyer-name');
      if (bn && !data.buyerName) data.buyerName = bn.textContent.trim();
      var fee = scope.querySelector('.oip-fee');
      if (fee && !data.fee) data.fee = fee.textContent.trim();
      var bd = scope.querySelector('.oip-bid-decision');
      if (bd && !data.bidDecision) data.bidDecision = bd.textContent.trim();

      arr.push(data);
    });
    return arr;
  }

  /* ── Utility ─────────────────────────────────────────────── */
  function daysLeft(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 864e5);
  }

  function deadlineHtml(d) {
    var dl = daysLeft(d);
    if (dl === null) return '<span class="oip-dl-ok">—</span>';
    var dateStr = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dl < 0) return '<span class="oip-dl-overdue">' + dateStr + ' (Overdue)</span>';
    if (dl <= 7) return '<span class="oip-dl-soon">' + dateStr + ' (' + dl + 'd)</span>';
    return '<span class="oip-dl-ok">' + dateStr + ' (' + dl + 'd)</span>';
  }

  function scoreHtml(s) {
    var cls = s >= 80 ? 'green' : s >= 60 ? 'yellow' : 'red';
    return '<div class="oip-score-cell">' +
      '<span class="oip-score-dot oip-score-dot--' + cls + '"></span>' +
      '<span class="oip-score-val">' + s + '</span></div>';
  }

  function stagePill(stage) {
    var css = STAGE_CSS[stage] || 'archived';
    return '<span class="oip-status oip-status--' + css + '">' + stage + '</span>';
  }

  function buyerPill(bt) {
    if (!bt) return '—';
    var css = BUYER_CSS[bt] || '';
    return '<span class="oip-buyer-pill' + (css ? ' oip-buyer-pill--' + css : '') + '">' + bt + '</span>';
  }

  /* ── Build Page ──────────────────────────────────────────── */
  function build() {
    if (!items.length) return;

    // Hide original page content
    document.querySelectorAll('[data-oip="list"], [data-oip="filters"], #oip-grid, #oip-stats, #oip-loading, .w-dyn-list').forEach(function(el) {
      el.style.display = 'none';
    });
    var firstCard = document.querySelector('[data-oip="card"]');
    if (firstCard) {
      var origContainer = firstCard.closest('[data-oip="list"]') || firstCard.closest('.w-dyn-list') || firstCard.closest('#oip-grid');
      if (origContainer) origContainer.style.display = 'none';
      var mainSection = firstCard.closest('section') || firstCard.closest('[class*="section"]') || firstCard.closest('main');
      if (mainSection) mainSection.style.display = 'none';
    }

    // Find or create shell
    var shell = document.querySelector('.oip-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'oip-shell';
      var main = document.querySelector('main') || document.querySelector('[role="main"]');
      if (main) main.parentNode.insertBefore(shell, main);
      else document.body.insertBefore(shell, document.body.firstChild);
    }

    shell.innerHTML = '';

    // Top bar
    shell.innerHTML += '<div class="oip-topbar"><div class="oip-topbar-left">' +
      '<h1>Opportunity Board</h1>' +
      '<span class="oip-topbar-count">' + items.length + ' items</span>' +
      '</div></div>';

    // Stats
    shell.innerHTML += '<div id="oip-stats"></div>';
    buildStats();

    // Toolbar
    shell.innerHTML +=
      '<div class="oip-toolbar">' +
      '<div class="oip-search">' + ICON_SEARCH +
      '<input type="text" id="oip-search" placeholder="Search opportunities...">' +
      '</div>' +
      '<select id="oip-stage" class="oip-filter-btn"><option value="">Stage</option></select>' +
      '<select id="oip-source" class="oip-filter-btn"><option value="">Source</option></select>' +
      '<select id="oip-buyer" class="oip-filter-btn"><option value="">Buyer Type</option></select>' +
      '<div class="oip-toolbar-sep"></div>' +
      '<select id="oip-sort" class="oip-filter-btn">' +
      '<option value="">Sort</option>' +
      '<option value="score-desc">Score: High → Low</option>' +
      '<option value="score-asc">Score: Low → High</option>' +
      '<option value="deadline-asc">Deadline: Soonest</option>' +
      '<option value="name-asc">Name: A → Z</option>' +
      '</select>' +
      '<div class="oip-toolbar-right">' +
      '<span id="oip-count" style="font-size:.8125rem;color:var(--m-text-3)"></span>' +
      '</div>' +
      '</div>';

    // Board
    shell.innerHTML += '<div id="oip-board"></div>';

    // Populate dropdowns
    populateDropdowns();

    // Wire events
    ['oip-search', 'oip-stage', 'oip-source', 'oip-buyer', 'oip-sort'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderBoard);
    });

    renderBoard();
  }

  function buildStats() {
    var el = document.getElementById('oip-stats');
    if (!el) return;
    var total = items.length;
    var active = items.filter(function (i) { return ACTIVE_STAGES.indexOf(i.stage) >= 0; }).length;
    var avg = total ? Math.round(items.reduce(function (s, i) { return s + i.score; }, 0) / total) : 0;
    var upcoming = items.filter(function (i) {
      var d = daysLeft(i.deadline);
      return d !== null && d >= 0 && d <= 30;
    }).length;

    el.innerHTML =
      kpi('#0073ea', '📊', total, 'Total Opportunities') +
      kpi('#00c875', '⚡', active, 'Active Pipeline') +
      kpi(avg >= 70 ? '#00c875' : avg >= 50 ? '#fdab3d' : '#e2445c', '🎯', avg, 'Avg Readiness') +
      kpi(upcoming > 0 ? '#fdab3d' : '#c4c4c4', '📅', upcoming, 'Due in 30 Days');
  }

  function kpi(color, icon, val, label) {
    return '<div class="oip-kpi">' +
      '<div class="oip-kpi-icon" style="background:' + color + '20">' + icon + '</div>' +
      '<div class="oip-kpi-data"><div class="oip-kpi-val">' + val + '</div>' +
      '<div class="oip-kpi-label">' + label + '</div></div></div>';
  }

  function populateDropdowns() {
    var stages = new Set(), sources = new Set(), bts = new Set();
    items.forEach(function (i) {
      if (i.stage) stages.add(i.stage);
      if (i.source) sources.add(i.source);
      if (i.buyerType) bts.add(i.buyerType);
    });
    fillSelect('oip-stage', stages);
    fillSelect('oip-source', sources);
    fillSelect('oip-buyer', bts);
  }

  function fillSelect(id, vals) {
    var el = document.getElementById(id);
    if (!el) return;
    var first = el.options[0].outerHTML;
    el.innerHTML = first;
    Array.from(vals).sort().forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
  }

  /* ── Render Board ────────────────────────────────────────── */
  function renderBoard() {
    var board = document.getElementById('oip-board');
    if (!board) return;

    var q = (document.getElementById('oip-search') || {}).value || '';
    q = q.toLowerCase();
    var sf = (document.getElementById('oip-stage') || {}).value || '';
    var sof = (document.getElementById('oip-source') || {}).value || '';
    var bf = (document.getElementById('oip-buyer') || {}).value || '';
    var sortVal = (document.getElementById('oip-sort') || {}).value || '';

    // Filter
    var filtered = items.filter(function (i) {
      if (sf && i.stage !== sf) return false;
      if (sof && i.source !== sof) return false;
      if (bf && i.buyerType !== bf) return false;
      if (q && (i.name + ' ' + i.buyerName + ' ' + i.source).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    // Sort
    if (sortVal) {
      filtered.sort(function (a, b) {
        if (sortVal === 'score-desc') return b.score - a.score;
        if (sortVal === 'score-asc') return a.score - b.score;
        if (sortVal === 'deadline-asc') return (a.deadline || 'z').localeCompare(b.deadline || 'z');
        if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
      });
    }

    // Update count
    var countEl = document.getElementById('oip-count');
    if (countEl) countEl.textContent = filtered.length + ' of ' + items.length;

    // Group by stage (maintain order)
    var groups = {};
    STAGES_ORDER.forEach(function (s) { groups[s] = []; });
    groups['Other'] = [];
    filtered.forEach(function (i) {
      var s = i.stage || 'Other';
      if (!groups[s]) groups[s] = [];
      groups[s].push(i);
    });

    // Column headers
    var html = '<div class="oip-col-headers">' +
      '<span></span>' +
      '<span>Opportunity</span>' +
      '<span>Buyer</span>' +
      '<span>Source</span>' +
      '<span>Buyer Type</span>' +
      '<span>Deadline</span>' +
      '<span>Score</span>' +
      '<span>Decision</span>' +
      '</div>';

    // Render groups
    var groupKeys = STAGES_ORDER.concat(Object.keys(groups).filter(function (k) {
      return STAGES_ORDER.indexOf(k) < 0;
    }));

    groupKeys.forEach(function (stage) {
      var rows = groups[stage];
      if (!rows || !rows.length) return;
      var color = STAGE_COLORS[stage] || '#c4c4c4';

      html += '<div class="oip-group" data-group="' + stage + '">';

      // Group header
      html += '<div class="oip-group-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
        '<span class="oip-group-chevron" style="transform:rotate(90deg)">' + ICON_CHEVRON + '</span>' +
        '<span class="oip-group-color" style="background:' + color + '"></span>' +
        '<span class="oip-group-name" style="color:' + color + '">' + stage + '</span>' +
        '<span class="oip-group-count">' + rows.length + '</span>' +
        '</div>';

      // Rows
      html += '<div class="oip-group-rows">';
      rows.forEach(function (item) {
        var decCls = '';
        var dec = item.bidDecision;
        if (dec === 'Bid') decCls = 'oip-decision--bid';
        else if (dec === 'No-Bid') decCls = 'oip-decision--no-bid';
        else if (dec === 'Conditional') decCls = 'oip-decision--conditional';

        var srcLink = item.sourceUrl
          ? '<a href="' + item.sourceUrl + '" target="_blank" rel="noopener" class="oip-ext-link" title="View bid request">' + ICON_EXTLINK + '</a>'
          : '';

        html += '<div class="oip-row">' +
          '<div class="oip-row-color" style="background:' + color + '"></div>' +
          '<div class="oip-row-name"><a href="' + item.slug + '" class="oip-row-link">' + item.name + '</a>' + srcLink + '</div>' +
          '<div class="oip-row-cell">' + (item.buyerName || '—') + '</div>' +
          '<div class="oip-row-cell">' + (item.source || '—') + '</div>' +
          '<div class="oip-row-cell">' + buyerPill(item.buyerType) + '</div>' +
          '<div class="oip-row-cell oip-deadline-text">' + deadlineHtml(item.deadline) + '</div>' +
          '<div class="oip-row-cell">' + scoreHtml(item.score) + '</div>' +
          '<div class="oip-row-cell">' + (dec ? '<span class="oip-buyer-pill ' + decCls + '">' + dec + '</span>' : '—') + '</div>' +
          '</div>';
      });
      html += '</div>'; // group-rows
      html += '</div>'; // group
    });

    // Summary row
    var avgScore = filtered.length ? Math.round(filtered.reduce(function (s, i) { return s + i.score; }, 0) / filtered.length) : 0;
    html += '<div class="oip-summary-row">' +
      '<span></span>' +
      '<span>' + filtered.length + ' opportunities</span>' +
      '<span></span><span></span><span></span><span></span>' +
      '<span>Avg: ' + avgScore + '</span>' +
      '<span></span>' +
      '</div>';

    board.innerHTML = html;
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    // Try API first (returns all items, no 100-item cap)
    fetch(API_URL)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.items && data.items.length > 0) {
          items = data.items.map(mapApiItem);
          build();
        } else {
          fallbackToDom();
        }
      })
      .catch(function () {
        fallbackToDom();
      });
  }

  function fallbackToDom() {
    // Wait for CMS items to be in the DOM
    if (!document.querySelector('.w-dyn-item')) {
      var attempts = 0;
      var timer = setInterval(function () {
        attempts++;
        if (document.querySelector('.w-dyn-item') || attempts > 20) {
          clearInterval(timer);
          items = extractItemsFromDom();
          build();
        }
      }, 200);
    } else {
      items = extractItemsFromDom();
      build();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
