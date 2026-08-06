/**
 * RTC Event Detail — Recurring Date Display Fix
 *
 * Rewrites the "Event Date" and "Recurring Event Dates" blocks on Calendar
 * Events Template pages so recurring events always show the next upcoming
 * occurrence instead of the original (first-ever) CMS date.
 *
 * Add to Calendar Events Template page settings → before-</body> custom code:
 *   <script defer src="https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@main/webflow/rtc-calendar/rtc-event-detail.js"></script>
 *
 * Dependency-free (no rrule). All parsing runs before any DOM write.
 * Any parse failure leaves the page completely untouched.
 *
 * Hosted on GitHub, served via jsDelivr CDN.
 */

(function () {
  'use strict';

  // Month abbreviations as they appear in the CMS recurring-dates string
  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Full month names for formatting the Event Date block output
  var MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

  /**
   * Returns today's date as { year, month (0-based), day } in America/New_York,
   * or falls back to local date if Intl is not available.
   * Accepts an override Date for testing.
   */
  function todayET(nowOverride) {
    var now = nowOverride || new Date();
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      var parts = fmt.formatToParts(now);
      var p = {};
      for (var i = 0; i < parts.length; i++) {
        p[parts[i].type] = parts[i].value;
      }
      return {
        year:  parseInt(p.year,  10),
        month: parseInt(p.month, 10) - 1,
        day:   parseInt(p.day,   10)
      };
    } catch (e) {
      return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    }
  }

  /**
   * Returns true if date {year,month,day} is on or after today {year,month,day}.
   */
  function isOnOrAfterToday(date, today) {
    if (date.year !== today.year) return date.year > today.year;
    if (date.month !== today.month) return date.month > today.month;
    return date.day >= today.day;
  }

  /**
   * Finds a .text-size-regular element whose trimmed text exactly matches
   * `labelText`, skipping elements with class w-condition-invisible.
   * Returns the element or null.
   */
  function findLabel(labelText) {
    var els = document.querySelectorAll('.text-size-regular');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('w-condition-invisible')) continue;
      if ((el.textContent || '').trim() === labelText) return el;
    }
    return null;
  }

  /**
   * Parse "February 25, 2026" → { year, month (0-based), day } or null.
   */
  function parseEventDate(text) {
    var m = /^([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec((text || '').trim());
    if (!m) return null;
    var monthIdx = MONTH_FULL.indexOf(m[1]);
    if (monthIdx === -1) return null;
    return { year: parseInt(m[3], 10), month: monthIdx, day: parseInt(m[2], 10) };
  }

  /**
   * Format a {year, month, day} object as "Month D, YYYY" (e.g. "August 26, 2026").
   */
  function formatFull(d) {
    return MONTH_FULL[d.month] + ' ' + d.day + ', ' + d.year;
  }

  /**
   * Format a {year, month, day} object as "Mon D" (e.g. "Aug 26") — for
   * the remaining-dates string, matching the source format.
   */
  function formatAbbr(d) {
    return MONTH_ABBR[d.month] + ' ' + d.day;
  }

  /**
   * Parse the recurring-dates string into a flat array of {year,month,day}
   * objects, in chronological order.
   *
   * Format: "Mon d[, d, …] • Mon d[, d, …] • …"
   * Year anchoring: starts at originalYear; increments when a group's month
   * index is less than the previous group's month index (Dec→Jan rollover).
   *
   * Returns null if any group fails to parse (signals abort).
   *
   * @param {string} src         - the raw recurring-dates string
   * @param {number} originalYear - year of the original event date
   */
  function parseRecurringString(src, originalYear) {
    var groups = src.split(' • '); // ' • '
    if (groups.length === 0) return null;

    var occurrences = [];
    var currentYear = originalYear;
    var prevMonthIdx = -1;

    for (var g = 0; g < groups.length; g++) {
      var group = groups[g].trim();
      // Each group: "Mon d, d, d" — month abbr then one or more day numbers
      var spaceIdx = group.indexOf(' ');
      if (spaceIdx === -1) return null;

      var monthStr = group.slice(0, spaceIdx);
      var monthIdx = MONTH_ABBR.indexOf(monthStr);
      if (monthIdx === -1) return null;

      // Year rollover: if this month comes before the previous group's month
      if (prevMonthIdx !== -1 && monthIdx < prevMonthIdx) {
        currentYear++;
      }
      prevMonthIdx = monthIdx;

      var daysStr = group.slice(spaceIdx + 1);
      var dayParts = daysStr.split(',');
      for (var d = 0; d < dayParts.length; d++) {
        var dayNum = parseInt(dayParts[d].trim(), 10);
        if (isNaN(dayNum)) return null;
        occurrences.push({ year: currentYear, month: monthIdx, day: dayNum });
      }
    }

    return occurrences.length > 0 ? occurrences : null;
  }

  /**
   * Re-group an array of {year,month,day} into a string matching the source
   * format: "Mon d, d • Mon d, d, d" (days within the same month-year group
   * separated by ", "; groups separated by " • ").
   *
   * Returns empty string if occurrences is empty.
   */
  function formatRecurringString(occurrences) {
    if (!occurrences || occurrences.length === 0) return '';

    var groups = [];
    var curKey = null;
    var curDays = [];

    for (var i = 0; i < occurrences.length; i++) {
      var occ = occurrences[i];
      var key = occ.year + '-' + occ.month;
      if (key !== curKey) {
        if (curKey !== null) {
          groups.push({ monthIdx: occurrences[i - curDays.length].month, days: curDays.slice() });
        }
        curKey = key;
        curDays = [occ.day];
      } else {
        curDays.push(occ.day);
      }
    }
    // push the last group
    if (curDays.length > 0) {
      groups.push({ monthIdx: occurrences[occurrences.length - curDays.length].month, days: curDays.slice() });
    }

    var parts = [];
    for (var g = 0; g < groups.length; g++) {
      parts.push(MONTH_ABBR[groups[g].monthIdx] + ' ' + groups[g].days.join(', '));
    }
    return parts.join(' • '); // ' • '
  }

  /**
   * Main entry point. Injectable `nowOverride` (Date) for testing.
   */
  function run(nowOverride) {
    try {
      // ── 1. Check this page has a "Recurring Event Dates" label ──────────
      var recurLabelEl = findLabel('Recurring Event Dates');
      if (!recurLabelEl) return; // not a recurring event page — nothing to do

      // ── 2. Parse original Event Date ────────────────────────────────────
      var dateLabelEl = findLabel('Event Date');
      if (!dateLabelEl) return;

      // The date value is the first child of .div-block-615 which follows
      // the .div-block-609 that wraps the "Event Date" label.
      var dateLabelWrapper = dateLabelEl.parentNode; // .div-block-609
      var dateValueBlock   = dateLabelWrapper && dateLabelWrapper.nextElementSibling; // .div-block-615
      if (!dateValueBlock) return;

      var dateValueEl = dateValueBlock.firstElementChild;
      if (!dateValueEl) return;

      var originalDate = parseEventDate((dateValueEl.textContent || '').trim());
      if (!originalDate) return;

      // ── 3. Parse the recurring-dates string ─────────────────────────────
      // The recurring-dates value is a sibling div directly after the
      // .div-block-609 that wraps the "Recurring Event Dates" label.
      var recurLabelWrapper = recurLabelEl.parentNode; // .div-block-609
      var recurValueEl      = recurLabelWrapper && recurLabelWrapper.nextElementSibling;
      if (!recurValueEl) return;

      var recurStr = (recurValueEl.textContent || '').trim();
      if (!recurStr) return;

      // ── 4. Build the full occurrence list (original date + CMS dates) ───
      var cmsOccurrences = parseRecurringString(recurStr, originalDate.year);
      if (!cmsOccurrences) return; // parse failure → abort

      // Prepend the original date itself (it is always occurrence #1)
      var allOccurrences = [originalDate].concat(cmsOccurrences);

      // ── 5. Find the display date: first occurrence on or after today ─────
      var today = todayET(nowOverride);
      var displayIdx = -1;
      for (var i = 0; i < allOccurrences.length; i++) {
        if (isOnOrAfterToday(allOccurrences[i], today)) {
          displayIdx = i;
          break;
        }
      }

      var displayDate;

      if (displayIdx === -1) {
        // Series fully in the past: show the final occurrence, no remaining
        displayDate = allOccurrences[allOccurrences.length - 1];
      } else {
        displayDate = allOccurrences[displayIdx];
      }

      // Remaining = occurrences strictly after displayDate (by value, not
      // position — the CMS string sometimes repeats the original date, so
      // positional slicing would double-list the displayed date).
      var remaining = [];
      for (var r = 0; r < allOccurrences.length; r++) {
        var occ = allOccurrences[r];
        var afterDisplay =
          occ.year > displayDate.year ||
          (occ.year === displayDate.year && (occ.month > displayDate.month ||
            (occ.month === displayDate.month && occ.day > displayDate.day)));
        if (afterDisplay) remaining.push(occ);
      }

      // ── 6. All parsing succeeded — now write to DOM ─────────────────────

      // Rewrite Event Date text (times in sibling divs are untouched)
      dateValueEl.textContent = formatFull(displayDate);

      // Rewrite recurring-dates string, or hide the block if nothing remains
      if (remaining.length === 0) {
        // Hide the label wrapper and value element
        recurLabelWrapper.style.display = 'none';
        recurValueEl.style.display      = 'none';
      } else {
        recurValueEl.textContent = formatRecurringString(remaining);
      }

    } catch (e) {
      // Any unexpected error: leave DOM completely untouched (already guaranteed
      // because all writes happen after all parsing, but belt-and-suspenders).
    }
  }

  // ── Export for testing ───────────────────────────────────────────────────
  // Expose pure functions under a namespace so a Node test harness can call
  // them directly without needing a browser DOM.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      todayET: todayET,
      isOnOrAfterToday: isOnOrAfterToday,
      parseEventDate: parseEventDate,
      parseRecurringString: parseRecurringString,
      formatRecurringString: formatRecurringString,
      formatFull: formatFull,
      run: run
    };
  } else {
    // ── Run at DOMContentLoaded (or immediately if already loaded) ───────
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { run(); });
    } else {
      run();
    }
  }

}());
