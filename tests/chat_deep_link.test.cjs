const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../custom_components/sms_gammu_viewer/frontend/panel.js'), 'utf8');

function fixture(number = '+70001234567') {
  const location = { href: 'https://ha.test/sms-viewer?chat=' + encodeURIComponent(number) };
  const state = { root: true, keep: 'HA history' };
  const window = { location, history: { state, replaceState(s, title, url) {
    assert.equal(s, state);
    location.href = String(url);
  } } };
  const methods = source.slice(source.indexOf('  set route(value)'), source.indexOf('  _token()'));
  const Panel = vm.runInNewContext(`(class { ${methods} })`, {
    URL, window, localStorage: { getItem: () => 'old-chat' },
  });
  const panel = new Panel();
  const opened = [];
  panel.isConnected = true;
  panel._contacts = [];
  panel._selectContact = n => { opened.push(n); panel._activeNumber = n; };
  panel._switchTab = () => {};
  return { panel, opened, location };
}

test('cold launch waits for initialization and overrides saved chat', () => {
  const { panel, opened, location } = fixture();
  panel.route = { path: '' };
  assert.equal(opened.length, 0);
  panel._restoreActiveChat();
  assert.deepEqual(opened, ['+70001234567']);
  assert.equal(new URL(location.href).searchParams.has('chat'), false);
});

test('warm navigation opens from phonebook even with stale contacts', () => {
  const { panel, opened } = fixture('Банк & Co/+');
  panel._chatLinkReady = true;
  panel._activeTab = 'phonebook';
  panel._activeNumber = 'another-chat';
  panel.route = { path: '' };
  assert.deepEqual(opened, ['Банк & Co/+']);
  assert.equal(panel._activeTab, 'chats');
  panel._openChatLink();
  assert.equal(opened.length, 1);
});

test('same chat opens again on a fresh notification, but not on other HA pages', () => {
  const { panel, opened, location } = fixture();
  panel._restoreActiveChat();
  location.href = 'https://ha.test/sms-viewer?chat=%2B70001234567';
  panel._openChatLink();
  assert.equal(opened.length, 2);
  location.href = 'https://ha.test/lovelace?chat=unrelated';
  panel._openChatLink();
  assert.equal(opened.length, 2);
});
