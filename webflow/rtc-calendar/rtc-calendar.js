/**
 * RTC Event Calendar — Webflow CMS Calendar Tool
 *
 * Reads events from a hidden Webflow CMS collection list (data-field attributes)
 * and renders an interactive FullCalendar with recurring event support via RRULE.
 *
 * Dependencies (add to page <head>):
 *   <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.17/index.global.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/rrule@2.8.1/dist/es5/rrule.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.17/index.global.min.js"></script>
 *
 * Hosted on GitHub, served via jsDelivr CDN.
 */

// ── RTC Config ──────────────────────────────────────────────────────
const CALENDAR_CONFIG = window.CALENDAR_CONFIG || {
  categoryColors: {
    'Signature Events':      '#141c4d',
    'Sales & Promotions':    '#df4661',
    'Kids & Family':         '#01b2a9',
    'Fitness & Wellness':    '#0278d4',
    'Music & Entertainment': '#8b5cf6',
    'Food & Dining':         '#f97316',
    'Arts & Culture':        '#a855f7',
    'Community':             '#fdda24',
    'Seasonal & Holiday':    '#a16207',
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

function buildRRule(startDate, frequency, dayOfWeek, weekOfMonth, endDate) {
  if (!frequency) return null;

  let rule = 'FREQ=';
  switch (frequency) {
    case 'Daily':
      rule += 'DAILY';
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

  const dt = new Date(startDate);
  const dtstart = dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  let until = '';
  if (endDate) {
    const ed = new Date(endDate);
    until = ';UNTIL=' + ed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  return 'DTSTART:' + dtstart + '\nRRULE:' + rule + until;
}

// ── DOM Reader ─────────────────────────────────────────────────────
function getField(item, fieldName) {
  // Try exact match first, then try with trailing space (Webflow Designer quirk)
  var el = item.querySelector('[data-field="' + fieldName + '"]');
  if (!el) el = item.querySelector('[data-field="' + fieldName + ' "]');
  if (!el) return '';
  if (el.tagName === 'IMG') return el.getAttribute('src') || '';
  if (el.tagName === 'A') return el.getAttribute('href') || '';
  if (el.hasAttribute('datetime')) return el.getAttribute('datetime');
  return (el.textContent || '').trim();
}

function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function hasField(item, fieldName) {
  return !!item.querySelector('[data-field="' + fieldName + '"]');
}

function readEventsFromDOM() {
  const items = document.querySelectorAll('.w-dyn-item');
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
    const heroImage   = getField(item, 'hero-image');
    const status      = getField(item, 'event-status');
    const featured    = hasField(item, 'featured-event');

    if (status === 'Cancelled') return;

    var startDate = parseDate(startStr);
    if (!name || !startDate) return;
    var endDate = parseDate(endStr);
    var recurEndDate = parseDate(recurEnd);

    const color = (category && CALENDAR_CONFIG.categoryColors[category])
      ? CALENDAR_CONFIG.categoryColors[category]
      : CALENDAR_CONFIG.defaultColor;

    const eventObj = {
      title: name,
      allDay: allDay,
      color: color,
      extendedProps: {
        summary: summary,
        cost: cost,
        category: category,
        heroImage: heroImage,
        status: status,
        featured: featured
      }
    };

    if (status === 'Postponed') {
      eventObj.title = '[Postponed] ' + name;
      eventObj.color = '#9ca3af';
    }

    if (isRecurring && frequency) {
      const rruleStr = buildRRule(startDate.toISOString(), frequency, dayOfWeek, weekOfMonth, recurEndDate ? recurEndDate.toISOString() : null);
      if (rruleStr) {
        eventObj.rrule = rruleStr;
        if (endDate && !allDay) {
          const diffMs = endDate.getTime() - startDate.getTime();
          if (diffMs > 0) {
            const hours   = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            eventObj.duration = { hours: hours, minutes: minutes };
          }
        }
      } else {
        eventObj.start = startDate.toISOString();
        if (endDate) eventObj.end = endDate.toISOString();
      }
    } else {
      eventObj.start = startDate.toISOString();
      if (endDate) eventObj.end = endDate.toISOString();
    }

    const linkEl = item.querySelector('a[href]');
    if (linkEl) {
      eventObj.extendedProps.detailUrl = linkEl.getAttribute('href');
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

  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.textContent = info.event.title;

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

  const costEl = document.getElementById('modalCost');
  if (costEl) {
    if (props.cost) {
      costEl.textContent = props.cost;
      costEl.style.display = '';
    } else {
      costEl.style.display = 'none';
    }
  }

  const descEl = document.getElementById('modalDescription');
  if (descEl) descEl.textContent = props.summary || '';

  const imgEl = document.getElementById('modalImage');
  if (imgEl) {
    if (props.heroImage) {
      imgEl.src = props.heroImage;
      imgEl.style.display = '';
    } else {
      imgEl.style.display = 'none';
    }
  }

  const linkEl = document.getElementById('modalLink');
  if (linkEl) {
    if (props.detailUrl) {
      linkEl.href = props.detailUrl;
      linkEl.style.display = '';
    } else {
      linkEl.style.display = 'none';
    }
  }

  modal.style.display = 'flex';
}

function hideModal() {
  const modal = document.getElementById('eventModal');
  if (modal) modal.style.display = 'none';
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var closeBtn  = document.getElementById('modalClose');
  var closeBtn2 = document.getElementById('modalCloseBtn');
  var modalBg   = document.getElementById('eventModal');
  if (closeBtn)  closeBtn.addEventListener('click', hideModal);
  if (closeBtn2) closeBtn2.addEventListener('click', hideModal);
  if (modalBg)   modalBg.addEventListener('click', function(e) {
    if (e.target === modalBg) hideModal();
  });

  if (window.fsAttributes && window.fsAttributes.push) {
    window.fsAttributes.push(['cmsload', function() {
      initCalendar();
    }]);
  } else {
    initCalendar();
  }
});

function initCalendar() {
  var calendarEl = document.getElementById('divCalendar');
  if (!calendarEl) return;

  var events = readEventsFromDOM();

  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: CALENDAR_CONFIG.initialView,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: CALENDAR_CONFIG.headerRight
    },
    events: events,
    eventContent: function(arg) {
      var props = arg.event.extendedProps;
      var cat = props.category || '';
      var catColor = (cat && CALENDAR_CONFIG.categoryColors[cat])
        ? CALENDAR_CONFIG.categoryColors[cat]
        : '';
      var timeStr = '';
      if (arg.event.start && !arg.event.allDay) {
        timeStr = arg.event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      var barColor = catColor || CALENDAR_CONFIG.defaultColor;
      var html = '<div class="fc-event-card" style="--card-color:' + barColor + '">';
      html += '<div class="fc-event-card-title">' + arg.event.title + '</div>';
      if (cat) {
        html += '<div class="fc-event-card-category" style="color:' + catColor + '">' + cat + '</div>';
      }
      if (timeStr) {
        html += '<div class="fc-event-card-time">' + timeStr + '</div>';
      }
      html += '</div>';
      return { html: html };
    },
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      if (CALENDAR_CONFIG.useModal) {
        showModal(info);
      } else if (info.event.extendedProps.detailUrl) {
        window.location.href = info.event.extendedProps.detailUrl;
      }
    },
    eventDidMount: function(info) {
      if (info.event.extendedProps.featured) {
        info.el.style.fontWeight = 'bold';
      }
    },
    height: 'auto',
    nowIndicator: true,
    dayMaxEvents: 3,
    moreLinkText: 'more',
    fixedWeekCount: false
  });

  calendar.render();
}
