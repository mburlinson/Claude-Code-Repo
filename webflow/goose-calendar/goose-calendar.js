/**
 * Goose Creek Village — Event Calendar
 * Webflow CMS Calendar Tool (based on RTC/Explore template)
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

// ── Goose Creek Village Config (overridable via window.CALENDAR_CONFIG) ─────
const CALENDAR_CONFIG = window.CALENDAR_CONFIG || {
  categoryColors: {
    'Sales & Promotions':   '#bc7f43',
    'Live Music':           '#a04a3e',
    'Food & Dining':        '#6b7d3e',
    'Family & Kids':        '#ebac6e',
    'Wellness & Fitness':   '#4a8c8e',
    'Seasonal & Holiday':   '#8b3a2f',
    'Community':            '#4a6c8c',
    'Workshops & Classes':  '#c97f4f',
    'Grand Openings':       '#6b3d6b',
    'Other':                '#5c4024'
  },
  initialView: 'dayGridMonth',
  headerRight: 'dayGridMonth,timeGridWeek,listMonth',
  useModal: true,
  defaultColor: '#5c4024',
  location: 'Goose Creek Village, 43170 Southern Walk Plaza, Ashburn, VA 20148'
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
  var el = item.querySelector('[data-field="' + fieldName + '"]');
  if (!el) el = item.querySelector('[data-field="' + fieldName + ' "]');
  if (!el) return '';
  if (el.tagName === 'IMG') return el.getAttribute('src') || '';
  if (el.tagName === 'A') return el.getAttribute('href') || '';
  if (el.hasAttribute('datetime')) return el.getAttribute('datetime');
  return (el.textContent || '').trim();
}

function getGalleryImages(item, fieldName) {
  var el = item.querySelector('[data-field="' + fieldName + '"]');
  if (!el) el = item.querySelector('[data-field="' + fieldName + ' "]');
  if (!el) return [];
  var imgs = el.querySelectorAll('img');
  var srcs = [];
  for (var i = 0; i < imgs.length; i++) {
    var src = imgs[i].getAttribute('src') || '';
    if (src) srcs.push(src);
  }
  return srcs;
}

function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// Category colors come from CMS text and are written into a style attribute,
// so only accept plain color values (hex, rgb/hsl, or a color keyword).
function safeColor(value) {
  return /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%deg]+\)|[a-z]+)$/i.test(value) ? value : '';
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
    const category    = getField(item, 'category-name') || getField(item, 'category');
    const catColor    = safeColor(getField(item, 'category-color'));
    const summary     = getField(item, 'short-summary');
    const cost        = getField(item, 'cost');
    const heroImage   = getField(item, 'hero-image');
    const galleryImgs = getGalleryImages(item, 'gallery-images');
    const status      = getField(item, 'event-status');
    const featured    = hasField(item, 'featured-event');

    if (status === 'Cancelled') return;

    var startDate = parseDate(startStr);
    if (!name || !startDate) return;
    var endDate = parseDate(endStr);
    var recurEndDate = parseDate(recurEnd);

    // Use color from CMS category reference, fall back to hardcoded map
    const color = catColor
      || (category && CALENDAR_CONFIG.categoryColors[category] ? CALENDAR_CONFIG.categoryColors[category] : null)
      || CALENDAR_CONFIG.defaultColor;

    const eventObj = {
      title: name,
      allDay: allDay,
      color: color,
      extendedProps: {
        summary: summary,
        cost: cost,
        category: category,
        catColor: catColor || color,
        heroImage: heroImage,
        galleryImages: galleryImgs,
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
      catEl.style.backgroundColor = props.catColor || CALENDAR_CONFIG.defaultColor;
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
      if (end) endTimeStr = ' \u2013 ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      dateEl.textContent = dateStr + ' \u00b7 ' + timeStr + endTimeStr;
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
    var imgSrc = props.heroImage;
    if (props.galleryImages && props.galleryImages.length > 0) {
      var idx = Math.floor(Math.random() * props.galleryImages.length);
      imgSrc = props.galleryImages[idx];
    }
    if (imgSrc) {
      imgEl.src = imgSrc;
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

  // Add to Calendar dropdown
  const addCalBtn = document.getElementById('modalAddCal');
  const addCalMenu = document.getElementById('addCalMenu');
  if (addCalBtn && addCalMenu) {
    addCalMenu.style.display = 'none';
    addCalBtn.setAttribute('type', 'button');
    addCalBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      addCalMenu.style.display = addCalMenu.style.display === 'none' ? 'block' : 'none';
    };

    var start = info.event.start;
    var end = info.event.end || new Date(start.getTime() + 3600000);
    var title = info.event.title;
    var desc = props.summary || '';
    var location = CALENDAR_CONFIG.location || 'Goose Creek Village, 43170 Southern Walk Plaza, Ashburn, VA 20148';

    // Google Calendar
    var gcalLink = document.getElementById('addCalGoogle');
    if (gcalLink) {
      var fmt = function(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
      gcalLink.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
        + '&text=' + encodeURIComponent(title)
        + '&dates=' + fmt(start) + '/' + fmt(end)
        + '&details=' + encodeURIComponent(desc)
        + '&location=' + encodeURIComponent(location);
      gcalLink.setAttribute('target', '_blank');
    }

    // Outlook Web
    var outlookLink = document.getElementById('addCalOutlook');
    if (outlookLink) {
      outlookLink.href = 'https://outlook.live.com/calendar/0/action/compose?rru=addevent'
        + '&subject=' + encodeURIComponent(title)
        + '&startdt=' + start.toISOString()
        + '&enddt=' + end.toISOString()
        + '&body=' + encodeURIComponent(desc)
        + '&location=' + encodeURIComponent(location);
      outlookLink.setAttribute('target', '_blank');
    }

    // ICS download (Apple Calendar, etc.)
    var icsLink = document.getElementById('addCalICS');
    if (icsLink) {
      var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
      var icsDate = function(d) {
        return d.getUTCFullYear().toString()
          + pad(d.getUTCMonth() + 1)
          + pad(d.getUTCDate()) + 'T'
          + pad(d.getUTCHours())
          + pad(d.getUTCMinutes())
          + pad(d.getUTCSeconds()) + 'Z';
      };
      var icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'DTSTART:' + icsDate(start),
        'DTEND:' + icsDate(end),
        'SUMMARY:' + title,
        'DESCRIPTION:' + desc.replace(/\n/g, '\\n'),
        'LOCATION:' + location,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      icsLink.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);
      icsLink.setAttribute('download', title.replace(/[^a-zA-Z0-9]/g, '_') + '.ics');
    }
  }

  modal.style.display = 'flex';
  document.documentElement.classList.add('cal-modal-open');
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
      var m = /DTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(e.rrule);
      if (m) start = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
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

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  hoistModal();

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
      var catColor = props.catColor
        || (cat && CALENDAR_CONFIG.categoryColors[cat] ? CALENDAR_CONFIG.categoryColors[cat] : '');
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
        html += '<div class="fc-event-card-clamp"><span class="fc-event-card-title">' + escapeHtml(arg.event.title) + '</span>';
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
    eventShortHeight: 40,
    nowIndicator: true,
    dayMaxEvents: 3,
    moreLinkText: 'more',
    fixedWeekCount: false
  });

  calendar.render();
}
