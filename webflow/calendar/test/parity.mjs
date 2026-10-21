// Recurrence parity test: calendar.js vs Envoy's session occurrences.
//
// Envoy expands each registration-required calendar event into sessions keyed
// by ET wall clock (YYYY-MM-DDTHH:mm). The calendar must produce the same keys
// from the same CMS values, or the status shown on a date won't match Envoy.
// This runs calendar.js's own reader + RRULE builder (in a vm, DOM stubbed)
// against Envoy's fixture (calendar-recurrence.json, copied from the
// knowledgeworks repo tests/fixtures) and expands with rrule 2.8.1 — the same
// build the site loads.
//
// Run (no package.json in this repo; install rrule anywhere throwaway):
//   npm i --prefix "$TMPDIR/rr" rrule@2.8.1
//   TZ=America/New_York RRULE_DIR="$TMPDIR/rr/node_modules/rrule" node webflow/calendar/test/parity.mjs
// (RRULE_DIR may also be passed as the first argument.)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TZ = 'America/New_York';

// ── Preconditions ──────────────────────────────────────────────────
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (localTz !== TZ) {
  console.error('Run under TZ=' + TZ + ' (process zone is ' + localTz + ').');
  process.exit(2);
}
const rruleDir = process.argv[2] || process.env.RRULE_DIR;
if (!rruleDir) {
  console.error('Set RRULE_DIR (or pass it as the first argument) to an rrule@2.8.1 install, e.g. $TMPDIR/rr/node_modules/rrule');
  process.exit(2);
}
const rrulePkg = JSON.parse(fs.readFileSync(path.join(rruleDir, 'package.json'), 'utf8'));
if (rrulePkg.version !== '2.8.1') {
  console.error('Expected rrule 2.8.1 (the version the site loads), found ' + rrulePkg.version);
  process.exit(2);
}
// The same UMD build the site loads from jsDelivr
const rrule = createRequire(import.meta.url)(path.join(rruleDir, 'dist/es5/rrule.min.js'));

// ── Load calendar.js in a sandbox ──────────────────────────────────
// Top-level code only declares functions and registers a DOMContentLoaded
// listener, which never fires here.
const sandbox = {
  window: {},
  document: { addEventListener: function() {} },
  console: console,
  URL: URL,
  URLSearchParams: URLSearchParams
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(HERE, '..', 'calendar.js'), 'utf8'), sandbox, { filename: 'calendar.js' });
const readEventsFromDOM = vm.runInContext('readEventsFromDOM', sandbox);
const buildRRule = vm.runInContext('buildRRule', sandbox);
if (typeof readEventsFromDOM !== 'function' || typeof buildRRule !== 'function') {
  console.error('calendar.js did not expose readEventsFromDOM/buildRRule');
  process.exit(2);
}

// ── Stub the hidden CMS list item the calendar reads ───────────────
// Text fields are elements with textContent; datetimes carry a datetime
// attribute; Switch fields are present only when on (conditional visibility).
function el(attrs, text) {
  return {
    tagName: 'DIV',
    textContent: text || '',
    hasAttribute: function(n) { return Object.prototype.hasOwnProperty.call(attrs, n); },
    getAttribute: function(n) { return Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null; }
  };
}

function stubItem(name, s) {
  const fields = { name: el({}, name) };
  if (s.start) fields['start-date-time'] = el({ datetime: s.start });
  if (s.end) fields['end-date-time'] = el({ datetime: s.end });
  if (s.allDay) fields['all-day-event'] = el({});
  if (s.recurring) fields['recurring'] = el({});
  if (s.frequency) fields['frequency'] = el({}, s.frequency);
  if (s.dayOfWeek) fields['day-of-week'] = el({}, s.dayOfWeek);
  if (s.weekOfMonth) fields['week-of-month'] = el({}, s.weekOfMonth);
  if (s.recurrenceEnd) fields['recurrence-end-date'] = el({ datetime: s.recurrenceEnd });
  return {
    querySelector: function(sel) {
      const m = /^\[data-field="([^"]+)"\]$/.exec(sel);
      if (m) return fields[m[1]] || null;
      return null; // no detail link in the stub
    }
  };
}

// ── Keys ───────────────────────────────────────────────────────────
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function localKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// rrule hands floating (zone-less) times back in the UTC fields; turn them
// into local Dates the way the calendar does (see expandSessions).
const HARD_LIMIT = 1000;
function expand(rruleStr, horizon) {
  const out = [];
  rrule.rrulestr(rruleStr).all(function(d, i) {
    const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    if (horizon && local > horizon) return false;
    if (i >= HARD_LIMIT) throw new Error('unbounded rule without a horizon');
    out.push(local);
    return true;
  });
  return out;
}

// ── Run ────────────────────────────────────────────────────────────
const fixtures = JSON.parse(fs.readFileSync(path.join(HERE, 'calendar-recurrence.json'), 'utf8'));
let failed = 0;

fixtures.forEach(function(f) {
  if (f.timeZone !== TZ) throw new Error('Fixture not in ' + TZ + ': ' + f.name);
  const events = readEventsFromDOM({ querySelectorAll: function() { return [stubItem('Fixture', f.schedule)]; } });
  if (events.length !== 1) throw new Error('Reader returned ' + events.length + ' events for ' + f.name);
  const ev = events[0];
  const horizon = f.horizon ? new Date(f.horizon) : null;

  let keys, how;
  if (ev.rrule) {
    keys = expand(ev.rrule, horizon).map(localKey);
    how = ev.rrule.replace('\n', ' ');
  } else {
    keys = [localKey(new Date(ev.start))];
    how = 'one-time start=' + ev.start;
  }

  const ok = keys.length === f.expectedKeys.length && keys.every(function(k, i) { return k === f.expectedKeys[i]; });
  console.log((ok ? 'PASS ' : 'FAIL ') + f.name);
  console.log('     ' + how + '  -> ' + keys.length + ' keys');
  if (!ok) {
    failed++;
    const missing = f.expectedKeys.filter(function(k) { return keys.indexOf(k) === -1; });
    const extra = keys.filter(function(k) { return f.expectedKeys.indexOf(k) === -1; });
    console.log('     expected: ' + f.expectedKeys.join(', '));
    console.log('     calendar: ' + keys.join(', '));
    if (missing.length) console.log('     missing:  ' + missing.join(', '));
    if (extra.length) console.log('     extra:    ' + extra.join(', '));
  }
});

// Sanity: buildRRule is the function the reader used (direct call agrees)
const direct = buildRRule(new Date('2026-10-28T17:00:00.000Z'), 'Weekly', 'Wed', null, new Date('2026-12-16T19:15:00.000Z'));
if (direct !== 'DTSTART:20261028T130000\nRRULE:FREQ=WEEKLY;BYDAY=WE;UNTIL=20261216T235959') {
  console.log('FAIL direct buildRRule sanity: ' + JSON.stringify(direct));
  failed++;
}

console.log('\n' + (fixtures.length - failed) + '/' + fixtures.length + ' fixtures match' + (failed ? ' — ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
