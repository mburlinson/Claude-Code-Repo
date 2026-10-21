/**
 * FullCalendar — Webflow CMS Calendar Tool
 *
 * Reads events from a hidden Webflow CMS collection list (data-field attributes)
 * and renders an interactive FullCalendar with recurring event support via RRULE.
 *
 * Dependencies (add to page <head>):
 *   <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.17/index.global.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/rrule@2.8.1/dist/es5/rrule.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.17/index.global.min.js"></script>
 *
 * Usage: Place this script in the page </body> custom code, after the CALENDAR_CONFIG block.
 *
 * Optional: CALENDAR_CONFIG.envoyFeedBase (e.g. 'https://register.envoyai.co/artplacedc')
 * turns on Envoy registration status for events with the Registration Required
 * switch on — see "Envoy registration status" below. Without it nothing is fetched.
 */

// ── Client Config (override per site) ──────────────────────────────
const CALENDAR_CONFIG = window.CALENDAR_CONFIG || {
  categoryColors: {
    'Kids & Family':         '#22c55e',
    'Fitness & Wellness':    '#3b82f6',
    'Music & Entertainment': '#8b5cf6',
    'Food & Dining':         '#f97316',
    'Arts & Culture':        '#a855f7',
    'Community':             '#ec4899',
    'Seasonal & Holiday':    '#a16207',
    'Shopping':              '#06b6d4',
    'Other':                 '#6b7280'
  },
  initialView: 'dayGridMonth',
  headerRight: 'dayGridMonth,timeGridWeek,listMonth',
  useModal: true,
  defaultColor: '#6b7280'
};

// ── RRULE Builder ──────────────────────────────────────────────────
const DAY_MAP  = { Mon:'MO', Tue:'TU', Wed:'WE', Thu:'TH', Fri:'FR', Sat:'SA', Sun:'SU' };
const WEEK_MAP = { '1st':'1', '2nd':'2', '3rd':'3', '4th':'4', 'Last':'-1' };

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// Local wall-clock stamp with no zone ("floating" time). FullCalendar repeats
// a floating DTSTART at the same local time, so a 1:00 PM weekly class stays
// at 1:00 PM after the November DST change; a UTC ("Z") DTSTART slides an hour.
function floatingStamp(d) {
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
    'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

function buildRRule(startDate, frequency, dayOfWeek, weekOfMonth, endDate) {
  if (!frequency) return null;

  let rule = 'FREQ=';
  switch (frequency) {
    case 'Daily':
      rule += 'DAILY';
      break;
    case 'Weekdays (Mon-Fri)':
    case 'Weekdays (Mon–Fri)':
    case 'Weekdays':
      // Mon–Fri only — used for camps/programs that skip weekends
      rule += 'WEEKLY;BYDAY=MO,TU,WE,TH,FR';
      break;
    case 'Weekends (Sat-Sun)':
    case 'Weekends (Sat–Sun)':
    case 'Weekends':
      rule += 'WEEKLY;BYDAY=SA,SU';
      break;
    case 'Weekly':
      rule += 'WEEKLY';
      if (dayOfWeek && DAY_MAP[dayOfWeek]) rule += ';BYDAY=' + DAY_MAP[dayOfWeek];
      break;
    case 'Bi-Weekly':
      rule += 'WEEKLY;INTERVAL=2';
      if (dayOfWeek && DAY_MAP[dayOfWeek]) rule += ';BYDAY=' + DAY_MAP[dayOfWeek];
      break;
    case 'Monthly':
      rule += 'MONTHLY';
      if (dayOfWeek && DAY_MAP[dayOfWeek]) {
        const weekNum = (weekOfMonth && WEEK_MAP[weekOfMonth]) ? WEEK_MAP[weekOfMonth] : '1';
        rule += ';BYDAY=' + weekNum + DAY_MAP[dayOfWeek];
      }
      break;
    case 'Yearly':
      rule += 'YEARLY';
      break;
    default:
      return null;
  }

  const dtstart = floatingStamp(new Date(startDate));

  // The recurrence end is a date: run through the end of that day, so the
  // last session still counts when it starts later than the stored time.
  let until = '';
  if (endDate) {
    const ed = new Date(endDate);
    until = ';UNTIL=' + floatingStamp(new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59));
  }

  return 'DTSTART:' + dtstart + '\nRRULE:' + rule + until;
}

// ── DOM Reader ─────────────────────────────────────────────────────
function getField(item, fieldName) {
  const el = item.querySelector('[data-field="' + fieldName + '"]');
  if (!el) return '';
  // For images, return src
  if (el.tagName === 'IMG') return el.getAttribute('src') || '';
  // For links, return href
  if (el.tagName === 'A') return el.getAttribute('href') || '';
  // For datetime fields bound via Webflow, check for datetime attribute first
  if (el.hasAttribute('datetime')) return el.getAttribute('datetime');
  return (el.textContent || '').trim();
}

// Parse Webflow date strings into Date objects.
// Handles ISO ("2026-03-18T08:00:00.000Z") and human-readable ("March 18, 2026").
function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// Switch/boolean fields use Webflow conditional visibility:
// Element present = true, element absent = false.
function hasField(item, fieldName) {
  return !!item.querySelector('[data-field="' + fieldName + '"]');
}

// root defaults to this page; the event-page session picker passes the
// calendar page's parsed document instead.
function readEventsFromDOM(root) {
  const items = (root || document).querySelectorAll('.w-dyn-item');
  const events = [];

  items.forEach(function(item) {
    const name        = getField(item, 'name');
    const startStr    = getField(item, 'start-date-time');
    const endStr      = getField(item, 'end-date-time');
    const allDay      = hasField(item, 'all-day-event');
    const isRecurring = hasField(item, 'recurring');
    const frequency   = getField(item, 'frequency');
    const dayOfWeek   = getField(item, 'day-of-week');
    const weekOfMonth = getField(item, 'week-of-month');
    const recurEnd    = getField(item, 'recurrence-end-date');
    const category    = getField(item, 'category');
    const summary     = getField(item, 'short-summary');
    const cost        = getField(item, 'cost');
    const ageGroup    = getField(item, 'age-group');
    const facilitator = getField(item, 'facilitator');
    const heroImage   = getField(item, 'hero-image');
    const status      = getField(item, 'event-status');
    const featured    = hasField(item, 'featured-event');
    const regRequired = hasField(item, 'registration-required');

    // Skip cancelled events
    if (status === 'Cancelled') return;

    // Parse dates
    var startDate = parseDate(startStr);
    if (!name || !startDate) return;
    var endDate = parseDate(endStr);
    var recurEndDate = parseDate(recurEnd);

    // Determine color from category
    const color = (category && CALENDAR_CONFIG.categoryColors[category])
      ? CALENDAR_CONFIG.categoryColors[category]
      : CALENDAR_CONFIG.defaultColor;

    // Build the event object
    const eventObj = {
      title: name,
      allDay: allDay,
      color: color,
      extendedProps: {
        summary: summary,
        cost: cost,
        ageGroup: ageGroup,
        facilitator: facilitator,
        category: category,
        heroImage: heroImage,
        status: status,
        featured: featured,
        registrationRequired: regRequired
      }
    };

    // Add postponed styling
    if (status === 'Postponed') {
      eventObj.title = '[Postponed] ' + name;
      eventObj.color = '#9ca3af';
    }

    // Recurring vs one-time
    if (isRecurring && frequency) {
      const rruleStr = buildRRule(startDate, frequency, dayOfWeek, weekOfMonth, recurEndDate);
      if (rruleStr) {
        eventObj.rrule = rruleStr;
        eventObj.extendedProps.recurring = true;
        // Duration for recurring events
        if (endDate && !allDay) {
          const diffMs = endDate.getTime() - startDate.getTime();
          if (diffMs > 0) {
            const hours   = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            eventObj.duration = { hours: hours, minutes: minutes };
          }
        }
      } else {
        // Fallback: treat as one-time if RRULE build fails
        eventObj.start = startDate.toISOString();
        if (endDate) eventObj.end = endDate.toISOString();
      }
    } else {
      eventObj.start = startDate.toISOString();
      if (endDate) eventObj.end = endDate.toISOString();
    }

    // Detail page link (from <a> inside the item)
    const linkEl = item.querySelector('a[href]');
    if (linkEl) {
      eventObj.extendedProps.detailUrl = linkEl.getAttribute('href');
      // The item slug (last path segment) names the event's Envoy program
      eventObj.extendedProps.slug = linkEl.getAttribute('href').split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop();
    }

    events.push(eventObj);
  });

  return events;
}

// ── Modal ──────────────────────────────────────────────────────────
function showModal(info) {
  const props = info.event.extendedProps;
  const modal = document.getElementById('eventModal');
  if (!modal) return;

  // Title
  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.textContent = info.event.title;

  // Category badge
  const catEl = document.getElementById('modalCategory');
  if (catEl) {
    if (props.category) {
      catEl.textContent = props.category;
      catEl.style.backgroundColor = info.event.backgroundColor || CALENDAR_CONFIG.defaultColor;
      catEl.style.display = '';
    } else {
      catEl.style.display = 'none';
    }
  }

  // Date/time
  const dateEl = document.getElementById('modalDate');
  if (dateEl) {
    const start = info.event.start;
    const end   = info.event.end;
    if (info.event.allDay) {
      dateEl.textContent = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      let endTimeStr = '';
      if (end) endTimeStr = ' – ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      dateEl.textContent = dateStr + ' · ' + timeStr + endTimeStr;
    }
  }

  // Cost
  const costEl = document.getElementById('modalCost');
  if (costEl) {
    if (props.cost) {
      costEl.textContent = props.cost;
      costEl.style.display = '';
    } else {
      costEl.style.display = 'none';
    }
  }

  // Age Group
  const ageGroupEl = document.getElementById('modalAgeGroup');
  if (ageGroupEl) {
    if (props.ageGroup) {
      ageGroupEl.textContent = props.ageGroup;
      ageGroupEl.style.display = '';
    } else {
      ageGroupEl.style.display = 'none';
    }
  }

  // Facilitator
  const facilitatorEl = document.getElementById('modalFacilitator');
  if (facilitatorEl) {
    if (props.facilitator) {
      facilitatorEl.textContent = props.facilitator;
      facilitatorEl.style.display = '';
    } else {
      facilitatorEl.style.display = 'none';
    }
  }

  // Description
  const descEl = document.getElementById('modalDescription');
  if (descEl) descEl.textContent = props.summary || '';

  // Hero image
  const imgEl = document.getElementById('modalImage');
  if (imgEl) {
    if (props.heroImage) {
      imgEl.src = props.heroImage;
      imgEl.style.display = '';
    } else {
      imgEl.style.display = 'none';
    }
  }

  // Detail link
  const linkEl = document.getElementById('modalLink');
  if (linkEl) {
    if (props.detailUrl) {
      linkEl.href = detailHref(info.event);
      linkEl.style.display = '';
    } else {
      linkEl.style.display = 'none';
    }
  }

  // Registration status + Register link (optional #modalStatus / #modalRegister;
  // both stay hidden unless Envoy has this session)
  applyRegistration(
    document.getElementById('modalStatus'),
    document.getElementById('modalRegister'),
    info.event.extendedProps.envoy,
    envoySessionFor(info.event),
    { showSpots: true, registerText: 'Register for this date' }
  );

  // Show modal (lock page scroll behind it)
  modal.style.display = 'flex';
  document.documentElement.classList.add('cal-modal-open');
}

function dateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// A recurring event has one detail page for all its sessions, so the link
// names the clicked session (?date=YYYY-MM-DD) for the page's session picker.
function detailHref(event) {
  var url = event.extendedProps.detailUrl;
  if (!event.extendedProps.recurring || !event.start) return url;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'date=' + dateKey(event.start);
}

function hideModal() {
  const modal = document.getElementById('eventModal');
  if (modal) modal.style.display = 'none';
  document.documentElement.classList.remove('cal-modal-open');
}

// The modal markup can sit inside a page section whose z-index is below the
// site nav, and some pages carry it twice (page embed + footer code). Keep the
// first copy and move it to <body> so it always layers above the page.
function hoistModal() {
  var modals = document.querySelectorAll('#eventModal');
  if (!modals.length) return;
  for (var i = 1; i < modals.length; i++) modals[i].remove();
  document.body.appendChild(modals[0]);
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  hoistModal();

  // Bind modal close buttons
  var closeBtn  = document.getElementById('modalClose');
  var closeBtn2 = document.getElementById('modalCloseBtn');
  var modalBg   = document.getElementById('eventModal');
  if (closeBtn)  closeBtn.addEventListener('click', hideModal);
  if (closeBtn2) closeBtn2.addEventListener('click', hideModal);
  if (modalBg)   modalBg.addEventListener('click', function(e) {
    if (e.target === modalBg) hideModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hideModal();
  });

  // Event detail page (CMS template): session picker for recurring events
  if (window.EVENT_SESSIONS_CONFIG) initSessionPicker(window.EVENT_SESSIONS_CONFIG);

  // Wait for Finsweet CMS Load if present, otherwise init immediately
  if (window.fsAttributes && window.fsAttributes.push) {
    window.fsAttributes.push(['cmsload', function() {
      initCalendar();
    }]);
  } else {
    initCalendar();
  }
});

// ── Responsive helpers ─────────────────────────────────────────────
// Phones get list views instead of the 7-column week grid, and open on
// the month list. Matches Webflow's 767px mobile-landscape breakpoint.
var PHONE_MAX_WIDTH = 767;

function isPhone() {
  return window.innerWidth <= PHONE_MAX_WIDTH;
}

function toolbarFor(phone) {
  return {
    left: 'prev,next today',
    center: 'title',
    right: phone ? (CALENDAR_CONFIG.headerRightPhone || 'dayGridMonth,listWeek,listMonth') : CALENDAR_CONFIG.headerRight
  };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Week view shows 8am–10pm, widened to fit any event outside that window
// (an event outside slotMinTime/slotMaxTime would otherwise not render).
function weekHourRange(events) {
  var min = 8, max = 22;
  events.forEach(function(e) {
    if (e.allDay) return;
    var start = null;
    if (e.start) {
      start = new Date(e.start);
    } else if (e.rrule) {
      // Floating (local wall-clock) DTSTART, see floatingStamp()
      var m = /DTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(e.rrule);
      if (m) start = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    }
    if (!start || isNaN(start.getTime())) return;
    var minutes = 60;
    if (e.duration) minutes = e.duration.hours * 60 + e.duration.minutes;
    else if (e.end) minutes = (new Date(e.end).getTime() - start.getTime()) / 60000;
    var startHour = start.getHours() + start.getMinutes() / 60;
    var endHour = startHour + minutes / 60;
    min = Math.min(min, Math.floor(startHour));
    // Events that run past midnight (or span days) render their visible part
    // anyway; only make sure their start hour is inside the window.
    if (endHour <= 24) max = Math.max(max, Math.ceil(endHour));
    else max = Math.max(max, Math.floor(startHour) + 1);
  });
  var pad = function(h) { return (h < 10 ? '0' : '') + h + ':00:00'; };
  return { min: pad(min), max: pad(max) };
}

function initCalendar() {
  var calendarEl = document.getElementById('divCalendar');
  if (!calendarEl) return;

  var events = readEventsFromDOM();
  var hours = weekHourRange(events);
  var phone = isPhone();
  calendarEl.classList.toggle('fc-phone', phone);

  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: phone ? (CALENDAR_CONFIG.initialViewPhone || 'listMonth') : CALENDAR_CONFIG.initialView,
    headerToolbar: toolbarFor(phone),
    views: {
      listWeek: { buttonText: 'week' },
      listMonth: { buttonText: 'list' },
      timeGridWeek: { slotMinTime: hours.min, slotMaxTime: hours.max }
    },
    windowResize: function() {
      // Only act when crossing the phone breakpoint (e.g. rotating a phone);
      // iOS also fires resize when the URL bar collapses.
      var nowPhone = isPhone();
      if (nowPhone === phone) return;
      phone = nowPhone;
      calendarEl.classList.toggle('fc-phone', phone);
      calendar.setOption('headerToolbar', toolbarFor(phone));
      var type = calendar.view.type;
      if (phone && type === 'timeGridWeek') calendar.changeView('listWeek');
      else if (!phone && type === 'listWeek') calendar.changeView('timeGridWeek');
    },
    events: events,
    eventContent: function(arg) {
      var props = arg.event.extendedProps;
      var cat = props.category || '';
      var catColor = (cat && CALENDAR_CONFIG.categoryColors[cat])
        ? CALENDAR_CONFIG.categoryColors[cat]
        : '';
      var viewType = arg.view.type;
      var isList = viewType.indexOf('list') === 0;
      var isTimeGrid = viewType.indexOf('timeGrid') === 0;
      var timeStr = '';
      // List views already print the time in their own column
      if (arg.event.start && !arg.event.allDay && !isList) {
        timeStr = arg.event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      var barColor = catColor || CALENDAR_CONFIG.defaultColor;
      var cardClass = 'fc-event-card' + (isList ? ' fc-event-card--list' : '') + (isTimeGrid ? ' fc-event-card--timegrid' : '');
      var html = '<div class="' + cardClass + '" style="--card-color:' + barColor + '">';
      // Time-grid boxes are sized by duration: title + time run inline and
      // clamp to the lines that fit, so nothing is cut mid-glyph
      if (isTimeGrid) {
        // A Full/Cancelled tag leads, so the line clamp can't cut it off
        html += '<div class="fc-event-card-clamp">' + envoyTagHtml(arg.event) + '<span class="fc-event-card-title">' + escapeHtml(arg.event.title) + '</span>';
        if (timeStr) html += ' <span class="fc-event-card-time">' + timeStr + '</span>';
        html += '</div></div>';
        return { html: html };
      }
      html += '<div class="fc-event-card-title">' + escapeHtml(arg.event.title) + '</div>';
      if (cat) {
        html += '<div class="fc-event-card-category" style="color:' + catColor + '">' + escapeHtml(cat) + '</div>';
      }
      if (timeStr) {
        html += '<div class="fc-event-card-time">' + timeStr + '</div>';
      }
      html += envoyTagHtml(arg.event);
      html += '</div>';
      return { html: html };
    },
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      if (CALENDAR_CONFIG.useModal) {
        showModal(info);
      } else if (info.event.extendedProps.detailUrl) {
        window.location.href = detailHref(info.event);
      }
    },
    eventDidMount: function(info) {
      if (info.event.extendedProps.featured) {
        info.el.style.fontWeight = 'bold';
      }
    },
    height: 'auto',
    eventShortHeight: 40,
    nowIndicator: true,
    dayMaxEvents: 3,
    moreLinkText: 'more',
    fixedWeekCount: false
  });

  calendar.render();

  // Registration status arrives after the calendar is on screen
  loadEnvoyStatus(calendar);
}

// ── Envoy registration status ──────────────────────────────────────
// An event with the Registration Required switch on gets a registration
// program in Envoy (program slug = the event's item slug) whose sessions
// mirror this calendar. Envoy publishes per-session status:
//   GET <envoyFeedBase>/<slug>/sessions.json
//   200 → { program: { registerUrl, waitlistEnabled, … },
//           sessions: [ { localDate: 'YYYY-MM-DD', localStart: 'HH:mm',
//                         status: 'open'|'waitlist'|'full'|'cancelled',
//                         spotsLeft: number|null, … } ] }
//   404 → the program isn't open yet (draft/beta/closed): show nothing.
// The calendar still decides the schedule; the feed only adds a status to a
// session. Sessions match on wall-clock date + start time ('YYYY-MM-DDTHH:mm'),
// the same local time the calendar places them at, so visitors outside ET
// match too. Any failure leaves the page exactly as it is without the feed.

var ENVOY_TIMEOUT_MS = 5000;
var ENVOY_STATUSES = { open: true, waitlist: true, full: true, cancelled: true };
var ENVOY_TEXT = {
  waitlist:  'This class is filled. Would you like to be part of the waitlist?',
  full:      'This class is full.',
  cancelled: 'This session is cancelled.'
};

// 'YYYY-MM-DDTHH:mm' from a Date's local (wall-clock) fields
function sessionKey(d) {
  return dateKey(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// Only http(s) links become hrefs
function safeHttpUrl(str) {
  if (typeof str !== 'string' || !str) return null;
  try {
    var u = new URL(str);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch (e) {
    return null;
  }
}

// Feed body → { registerUrl, waitlistEnabled, byKey: { key: session } }
function envoyStatusMap(data) {
  if (!data || !data.program || !Array.isArray(data.sessions)) return null;
  var byKey = {};
  data.sessions.forEach(function(s) {
    if (!s || !ENVOY_STATUSES[s.status]) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.localDate) || !/^\d{2}:\d{2}$/.test(s.localStart)) return;
    byKey[s.localDate + 'T' + s.localStart] = {
      status: s.status,
      spotsLeft: (typeof s.spotsLeft === 'number' && isFinite(s.spotsLeft)) ? s.spotsLeft : null,
      localDate: s.localDate
    };
  });
  return {
    registerUrl: safeHttpUrl(data.program.registerUrl),
    waitlistEnabled: !!data.program.waitlistEnabled,
    byKey: byKey
  };
}

// Resolves to the status map, or null when the program isn't open (404).
// Rejects on network errors, other HTTP errors and the timeout.
function fetchEnvoyFeed(base, slug) {
  var url = String(base).replace(/\/+$/, '') + '/' + encodeURIComponent(slug) + '/sessions.json';
  var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, ENVOY_TIMEOUT_MS) : null;
  function done() { if (timer) clearTimeout(timer); }
  var opts = { credentials: 'omit' };
  if (ctrl) opts.signal = ctrl.signal;
  return fetch(url, opts)
    .then(function(res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      done();
      return data ? envoyStatusMap(data) : null;
    }, function(err) {
      done();
      throw err;
    });
}

// The Envoy session for a calendar occurrence, if the feed has one
function envoySessionFor(event) {
  var envoy = event.extendedProps.envoy;
  if (!envoy || !envoy.byKey || !event.start) return null;
  return envoy.byKey[sessionKey(event.start)] || null;
}

function spotsText(n) {
  return n + (n === 1 ? ' spot left' : ' spots left');
}

function registerHref(envoy, localDate) {
  var u = new URL(envoy.registerUrl);
  u.searchParams.set('date', localDate);
  return u.href;
}

// Small "Full" / "Cancelled" tag for an event chip ('' for open sessions)
function envoyTagHtml(event) {
  var s = envoySessionFor(event);
  if (!s) return '';
  var text = '', mod = '';
  if (s.status === 'full' || s.status === 'waitlist') text = 'Full';
  else if (s.status === 'cancelled') { text = 'Cancelled'; mod = ' fc-event-card-tag--cancelled'; }
  if (!text) return '';
  return '<span class="fc-event-card-tag' + mod + '">' + escapeHtml(text) + '</span>';
}

// Fill a status element and a register link for one session, or hide both
// when there is no session. Either element may be missing.
//   opts.showSpots     — open sessions show "N spots left" in the status
//   opts.registerText  — link text for open sessions
function applyRegistration(statusEl, linkEl, envoy, session, opts) {
  var status = '', label = '', href = '';
  if (envoy && session) {
    if (session.status === 'open') {
      if (opts.showSpots && session.spotsLeft !== null) status = spotsText(session.spotsLeft);
      label = opts.registerText;
    } else if (session.status === 'waitlist') {
      status = ENVOY_TEXT.waitlist;
      label = 'Join the waitlist';
    } else {
      status = ENVOY_TEXT[session.status] || '';
    }
    if (label && envoy.registerUrl) href = registerHref(envoy, session.localDate);
  }
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.style.display = status ? '' : 'none';
  }
  if (linkEl) {
    if (href) {
      linkEl.setAttribute('href', href);
      linkEl.textContent = label;
      linkEl.removeAttribute('target'); // same tab
      // Set explicitly: the element may be hidden by a class, not only inline
      linkEl.style.display = 'inline-block';
    } else {
      linkEl.style.display = 'none';
    }
  }
}

// Calendar page: one feed request per registration-required event, in
// parallel; each answer is stored on the event so FullCalendar re-renders it.
function loadEnvoyStatus(calendar) {
  var base = CALENDAR_CONFIG.envoyFeedBase;
  if (!base || !window.fetch || typeof Promise === 'undefined' || !Promise.allSettled) return;
  var bySlug = {};
  calendar.getEvents().forEach(function(ev) {
    var p = ev.extendedProps;
    if (!p.registrationRequired || !p.slug) return;
    (bySlug[p.slug] = bySlug[p.slug] || []).push(ev);
  });
  var slugs = Object.keys(bySlug);
  if (!slugs.length) return;
  Promise.allSettled(slugs.map(function(slug) { return fetchEnvoyFeed(base, slug); }))
    .then(function(results) {
      calendar.batchRendering(function() {
        results.forEach(function(r, i) {
          if (r.status === 'rejected') {
            if (window.console) console.warn('[calendar] registration status for ' + slugs[i] + ':', r.reason);
            return;
          }
          if (!r.value) return;
          bySlug[slugs[i]].forEach(function(ev) { ev.setExtendedProp('envoy', r.value); });
        });
      });
    });
}

// ── Event page: session picker ─────────────────────────────────────
// A recurring event is one CMS item with one detail page. On that page this
// adds a "Date:" row with a dropdown of the event's sessions, set to the one
// clicked in the calendar (?date=YYYY-MM-DD) or else the next upcoming one,
// and shows the chosen session's date in the page's date line.
//
// The schedule comes from the calendar page's hidden CMS list, read with the
// same reader and RRULE builder the calendar uses, so the two always agree.
// One-off events, and any failure here, leave the page as Webflow rendered it.
//
// Template page config (before this script; rrule.min.js must load first):
//   window.EVENT_SESSIONS_CONFIG = {
//     calendarUrl:    '/event-calendar',  // page carrying the hidden CMS list
//     dateSelector:   '…',               // element showing the event date
//     rowSelector:    '…',               // detail rows (label + value)
//     textSelector:   '…',               // label/value text inside a row
//     rowBeforeLabel: 'Start Time',       // the picker row goes above this row
//     label:          'Date:',
//     envoyFeedBase:  '…'                 // optional: Envoy registration status
//   };
//
// With envoyFeedBase set, a registration-required event whose Envoy program
// is open also gets: each session's status in its dropdown label, a status
// line under the picker row, and the template's [data-envoy-register] link
// (hidden by default) pointed at the chosen session. One-off events get the
// status line and link for their single session.

var SESSION_LIMIT = 200;

function pagePath(href) {
  return new URL(href, window.location.origin).pathname.replace(/\/+$/, '').toLowerCase();
}

// Every session start of a recurring event as a local Date (open-ended rules
// stop a year out). rrule hands floating times back in the UTC fields.
function expandSessions(eventObj) {
  var horizon = new Date();
  horizon.setFullYear(horizon.getFullYear() + 1);
  var out = [];
  window.rrule.rrulestr(eventObj.rrule).all(function(d, i) {
    var local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    if (i >= SESSION_LIMIT || local > horizon) return false;
    out.push(local);
    return true;
  });
  return out;
}

function sessionLabel(start, durMs, allDay, withYear) {
  var dateOpts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (withYear) dateOpts.year = 'numeric';
  var label = start.toLocaleDateString('en-US', dateOpts);
  if (allDay) return label;
  var timeOpts = { hour: 'numeric', minute: '2-digit' };
  var from = start.toLocaleTimeString('en-US', timeOpts);
  if (!durMs) return label + ' · ' + from;
  var to = new Date(start.getTime() + durMs).toLocaleTimeString('en-US', timeOpts);
  // "1:00–2:15 PM" rather than "1:00 PM – 2:15 PM" (keeps it short on phones)
  if (from.slice(-2) === to.slice(-2)) from = from.slice(0, -3);
  return label + ' · ' + from + '–' + to;
}

function injectSessionPickerStyle() {
  if (document.getElementById('cal-session-style')) return;
  var chevron = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23222' stroke-width='1.6'/%3E%3C/svg%3E";
  var style = document.createElement('style');
  style.id = 'cal-session-style';
  style.textContent =
    '.cal-session-select{font:inherit;color:inherit;letter-spacing:inherit;line-height:1.3;max-width:100%;margin:0;text-overflow:ellipsis;' +
    'padding:.3em 2.2em .3em .6em;border:1px solid currentColor;border-radius:6px;cursor:pointer;' +
    '-webkit-appearance:none;appearance:none;background:transparent url("' + chevron + '") no-repeat right .7em center/.75em auto}' +
    '.cal-session-select:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
    // A percentage width lets the dropdown shrink to the row on phones
    '@media (max-width:' + PHONE_MAX_WIDTH + 'px){.cal-session-select{width:100%}}';
  document.head.appendChild(style);
}

// The detail row the picker row goes above (the rowBeforeLabel row, else the first)
function pickerAnchorRow(cfg) {
  var rows = document.querySelectorAll(cfg.rowSelector);
  var before = rows[0] || null;
  for (var r = 0; r < rows.length; r++) {
    if (cfg.rowBeforeLabel && rows[r].textContent.trim().indexOf(cfg.rowBeforeLabel) === 0) { before = rows[r]; break; }
  }
  return before;
}

// Returns { select, sessions, labels, row, valueEl } once the picker is on
// the page, or null when the event has no picker.
function renderSessionPicker(eventObj, cfg) {
  var sessions = expandSessions(eventObj);
  if (sessions.length < 2) return null;

  var allDay = eventObj.allDay;
  var d = eventObj.duration;
  var durMs = allDay ? 86400000 : (d ? (d.hours * 60 + d.minutes) * 60000 : 0);
  var now = Date.now();
  var wanted = new URLSearchParams(window.location.search).get('date');
  var requested = -1, upcoming = -1;
  for (var i = 0; i < sessions.length; i++) {
    if (requested === -1 && dateKey(sessions[i]) === wanted) requested = i;
    if (upcoming === -1 && sessions[i].getTime() + durMs >= now) upcoming = i;
  }

  // List the sessions still to come (from the requested one, if that is
  // earlier); once the run is over, list them all.
  var first = upcoming === -1 ? 0 : upcoming;
  if (requested !== -1 && requested < first) first = requested;
  var shown = sessions.slice(first);
  var selected = requested !== -1 ? requested - first : (upcoming !== -1 ? upcoming - first : 0);
  var withYear = shown[0].getFullYear() !== shown[shown.length - 1].getFullYear();

  // The new row is a copy of an existing detail row, so it keeps the
  // template's own classes and layout
  var before = pickerAnchorRow(cfg);
  if (!before) return null;
  var row = before.cloneNode(true);
  row.classList.remove('w-condition-invisible');
  // The dropdown box is taller than a text line: line the label up with its text
  row.style.alignItems = 'baseline';
  var texts = row.querySelectorAll(cfg.textSelector);
  if (texts.length < 2) return null;

  var select = document.createElement('select');
  select.className = 'cal-session-select';
  select.setAttribute('aria-label', 'Choose a session date');
  var labels = [];
  shown.forEach(function(start, n) {
    var opt = document.createElement('option');
    opt.value = dateKey(start);
    opt.textContent = labels[n] = sessionLabel(start, durMs, allDay, withYear);
    if (n === selected) opt.selected = true;
    select.appendChild(opt);
  });

  texts[0].textContent = cfg.label || 'Date:';
  texts[1].classList.remove('w-dyn-bind-empty');
  texts[1].textContent = '';
  texts[1].appendChild(select);
  // Let the value cell shrink on phones so a long label can't widen the rows
  for (var el = texts[1]; el && el !== row; el = el.parentNode) el.style.minWidth = '0';
  injectSessionPickerStyle();
  before.parentNode.insertBefore(row, before);

  var dateEl = cfg.dateSelector ? document.querySelector(cfg.dateSelector) : null;
  function showDate(n) {
    if (dateEl) dateEl.textContent = shown[n].toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  showDate(selected);

  select.addEventListener('change', function() {
    showDate(select.selectedIndex);
    // Keep the address shareable for the chosen session
    var url = new URL(window.location.href);
    url.searchParams.set('date', select.value);
    history.replaceState(null, '', url);
  });

  return { select: select, sessions: shown, labels: labels, row: row, valueEl: texts[1] };
}

var ENVOY_OPTION_SUFFIX = {
  waitlist:  ' — Full, join the waitlist',
  full:      ' — Full',
  cancelled: ' — Cancelled'
};

// A status line styled like the detail rows' value text, spaced like a row
function makeStatusLine(valueEl, rowEl) {
  var line = document.createElement('div');
  if (valueEl) line.className = valueEl.className.replace(/\b(w-dyn-bind-empty|w-condition-invisible)\b/g, '').replace(/\s+/g, ' ').trim();
  if (rowEl && window.getComputedStyle) line.style.marginBottom = window.getComputedStyle(rowEl).marginBottom;
  line.setAttribute('data-envoy-status', '');
  line.setAttribute('aria-live', 'polite');
  line.style.display = 'none';
  return line;
}

// Event page: decorate the picker (or a one-off's single session) with the
// event's Envoy status. Runs after the picker is on screen; 404, errors and
// a missing feed base leave the page untouched.
function initEventRegistration(eventObj, picker, cfg) {
  var base = cfg.envoyFeedBase;
  var slug = eventObj.extendedProps.slug;
  if (!base || !slug || !eventObj.extendedProps.registrationRequired) return;

  // Without a dropdown, only a single session can be matched
  var single = null;
  if (!picker) {
    if (!eventObj.rrule) single = new Date(eventObj.start);
    else {
      var all = expandSessions(eventObj);
      if (all.length === 1) single = all[0];
    }
    if (!single || isNaN(single.getTime())) return;
  }

  fetchEnvoyFeed(base, slug)
    .then(function(envoy) {
      if (!envoy) return;
      var link = document.querySelector('[data-envoy-register]');
      var opts = { showSpots: false, registerText: 'Register' };

      if (!picker) {
        var anchor = pickerAnchorRow(cfg);
        var line = null;
        if (anchor) {
          line = makeStatusLine(anchor.querySelectorAll(cfg.textSelector)[1], anchor);
          anchor.parentNode.insertBefore(line, anchor);
        }
        applyRegistration(line, link, envoy, envoy.byKey[sessionKey(single)] || null, opts);
        return;
      }

      var found = picker.sessions.map(function(start) { return envoy.byKey[sessionKey(start)] || null; });
      for (var n = 0; n < found.length; n++) {
        var s = found[n], suffix = '';
        if (s) {
          if (ENVOY_OPTION_SUFFIX[s.status]) suffix = ENVOY_OPTION_SUFFIX[s.status];
          else if (s.status === 'open' && s.spotsLeft !== null) suffix = ' — ' + spotsText(s.spotsLeft);
        }
        picker.select.options[n].textContent = picker.labels[n] + suffix;
      }

      var statusLine = makeStatusLine(picker.valueEl, picker.row);
      picker.row.parentNode.insertBefore(statusLine, picker.row.nextSibling);
      function update() {
        applyRegistration(statusLine, link, envoy, found[picker.select.selectedIndex] || null, opts);
      }
      update();
      picker.select.addEventListener('change', update);
    })
    .catch(function(err) {
      if (window.console) console.warn('[calendar] registration status:', err);
    });
}

function initSessionPicker(cfg) {
  if (!window.rrule || !window.fetch || !window.DOMParser) return;
  var here = pagePath(window.location.href);
  fetch(cfg.calendarUrl || '/event-calendar', { credentials: 'same-origin' })
    .then(function(res) {
      if (!res.ok) throw new Error('calendar page HTTP ' + res.status);
      return res.text();
    })
    .then(function(html) {
      var events = readEventsFromDOM(new DOMParser().parseFromString(html, 'text/html'));
      var oneOff = null;
      for (var i = 0; i < events.length; i++) {
        var url = events[i].extendedProps.detailUrl;
        if (!url || pagePath(url) !== here) continue;
        if (events[i].rrule) {
          initEventRegistration(events[i], renderSessionPicker(events[i], cfg), cfg);
          return;
        }
        if (!oneOff) oneOff = events[i];
      }
      if (oneOff) initEventRegistration(oneOff, null, cfg);
    })
    .catch(function(err) {
      if (window.console) console.warn('[calendar] session picker:', err);
    });
}
