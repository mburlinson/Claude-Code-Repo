// Registration overlay helpers (calendar.js "Registration overlay").
//
// Loads calendar.js in a vm with the DOM stubbed (same technique as
// parity.mjs; top-level code only declares functions and registers a
// DOMContentLoaded listener) and checks the pure pieces the overlay relies
// on: the frame URL (same register URL + embed=1, Envoy host only), the
// message origin/source check, plain-click detection, and which config
// governs a Register link (registerModal defaults off = v1.0.18 behaviour).
//
// Run (no dependencies):
//   node webflow/calendar/test/register-modal.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = fs.readFileSync(path.join(HERE, '..', 'calendar.js'), 'utf8');
const BASE = 'https://register.envoyai.co/artplacedc';

function load(windowProps) {
  const sandbox = {
    window: Object.assign({}, windowProps || {}),
    document: { addEventListener: function() {} },
    console: console,
    URL: URL,
    URLSearchParams: URLSearchParams
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'calendar.js' });
  return (name) => vm.runInContext(name, sandbox);
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}

const get = load();
const envoyOrigin = get('envoyOrigin');
const registerEmbedUrl = get('registerEmbedUrl');
const isEnvoyRegisterMessage = get('isEnvoyRegisterMessage');
const isPlainClick = get('isPlainClick');

test('envoyOrigin: the feed base origin, or empty', () => {
  assert.equal(envoyOrigin(BASE), 'https://register.envoyai.co');
  assert.equal(envoyOrigin('https://register-staging.envoyai.co/artplacedc/'), 'https://register-staging.envoyai.co');
  assert.equal(envoyOrigin(''), '');
  assert.equal(envoyOrigin(undefined), '');
  assert.equal(envoyOrigin('javascript:alert(1)'), '');
});

test('registerEmbedUrl: same register URL (date kept) plus embed=1', () => {
  assert.equal(
    registerEmbedUrl('https://register.envoyai.co/artplacedc/royal-voices/register?date=2026-11-18', BASE),
    'https://register.envoyai.co/artplacedc/royal-voices/register?date=2026-11-18&embed=1'
  );
  assert.equal(
    registerEmbedUrl('https://register.envoyai.co/artplacedc/royal-voices/register', BASE),
    'https://register.envoyai.co/artplacedc/royal-voices/register?embed=1'
  );
  // Already there: not doubled
  assert.equal(
    registerEmbedUrl('https://register.envoyai.co/artplacedc/x/register?embed=1&date=2026-11-18', BASE),
    'https://register.envoyai.co/artplacedc/x/register?embed=1&date=2026-11-18'
  );
});

test('registerEmbedUrl: anything not on the Envoy host stays a normal link', () => {
  assert.equal(registerEmbedUrl('https://evil.example/artplacedc/x/register', BASE), null);
  assert.equal(registerEmbedUrl('http://register.envoyai.co/artplacedc/x/register', BASE), null);
  assert.equal(registerEmbedUrl('#', BASE), null);
  assert.equal(registerEmbedUrl('/artplacedc/x/register', BASE), null);
  assert.equal(registerEmbedUrl('', BASE), null);
  assert.equal(registerEmbedUrl(null, BASE), null);
  assert.equal(registerEmbedUrl('https://register.envoyai.co/artplacedc/x/register', ''), null);
});

test('isEnvoyRegisterMessage: exact Envoy origin and source only', () => {
  const ok = { origin: 'https://register.envoyai.co', data: { source: 'envoy-register', type: 'ready' } };
  assert.equal(isEnvoyRegisterMessage(ok, BASE), true);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register.envoyai.co', data: { source: 'envoy-register', type: 'complete', status: 'confirmed' } }, BASE), true);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://evil.example', data: ok.data }, BASE), false);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register.envoyai.co.evil.example', data: ok.data }, BASE), false);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register-staging.envoyai.co', data: ok.data }, BASE), false);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register.envoyai.co', data: { source: 'other', type: 'ready' } }, BASE), false);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register.envoyai.co', data: 'envoy-register' }, BASE), false);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register.envoyai.co', data: { source: 'envoy-register' } }, BASE), false);
  assert.equal(isEnvoyRegisterMessage({ origin: 'https://register.envoyai.co', data: null }, BASE), false);
  assert.equal(isEnvoyRegisterMessage(ok, ''), false);
});

test('isPlainClick: modifier and non-primary clicks keep normal link behaviour', () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  assert.equal(isPlainClick(plain), true);
  for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) assert.equal(isPlainClick(Object.assign({}, plain, { [k]: true })), false, k);
  assert.equal(isPlainClick(Object.assign({}, plain, { button: 1 })), false);
});

function fakeLink(attrs) {
  return {
    id: attrs.id || '',
    hasAttribute: (n) => Object.prototype.hasOwnProperty.call(attrs, n),
    getAttribute: (n) => (Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null)
  };
}

test('regModalConfigFor: off by default (v1.0.18 behaviour)', () => {
  const regModalConfigFor = get('regModalConfigFor');
  assert.equal(regModalConfigFor(fakeLink({ id: 'modalRegister' })), null);
  assert.equal(regModalConfigFor(fakeLink({ 'data-envoy-register': '' })), null);
});

test('regModalConfigFor: each link follows its own page config', () => {
  const calOnly = load({ CALENDAR_CONFIG: { registerModal: true, envoyFeedBase: BASE } })('regModalConfigFor');
  assert.equal(calOnly(fakeLink({ id: 'modalRegister' })).envoyFeedBase, BASE);
  assert.equal(calOnly(fakeLink({ 'data-envoy-register': '' })), null);

  const pageOnly = load({ EVENT_SESSIONS_CONFIG: { registerModal: true, envoyFeedBase: BASE } })('regModalConfigFor');
  assert.equal(pageOnly(fakeLink({ 'data-envoy-register': '' })).envoyFeedBase, BASE);
  assert.equal(pageOnly(fakeLink({ id: 'modalRegister' })), null);

  // registerModal without a feed base, or a non-true value: off
  assert.equal(load({ CALENDAR_CONFIG: { registerModal: true } })('regModalConfigFor')(fakeLink({ id: 'modalRegister' })), null);
  assert.equal(load({ CALENDAR_CONFIG: { registerModal: 'yes', envoyFeedBase: BASE } })('regModalConfigFor')(fakeLink({ id: 'modalRegister' })), null);
});

console.log('\n' + passed + ' passed');
