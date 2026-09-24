const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../custom_components/sms_gammu_viewer/frontend/panel.js'), 'utf8');
const start = source.indexOf('    area.querySelectorAll(".msg-bubble").forEach((bubble) => {');
const end = source.indexOf('    // Скроллим вниз при первом открытии чата', start);
assert.ok(start >= 0 && end > start);
const bindSource = `(function(area) { ${source.slice(start, end)} })`;

function fixture(desktop) {
  const listeners = new Map();
  const timers = new Map();
  const copied = [];
  const menus = [];
  let nextTimer = 0;
  const bubble = {
    isConnected: true,
    querySelectorAll: () => [],
    querySelector: () => ({ textContent: 'whole message' }),
    addEventListener: (name, handler) => listeners.set(name, handler),
    classList: { add() {}, remove() {} },
  };
  const context = {
    navigator: { clipboard: { writeText: async text => copied.push(text) } },
    location: { protocol: 'https:' },
    window: { matchMedia: () => ({ matches: desktop }) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    fireHaptic() {},
  };
  const panel = {
    _activeNumber: 'beeline',
    _chatGestureToken: 0,
    _chatGestureMoved: false,
    _showMsgCtxMenu: () => menus.push('open'),
    _showToast() {},
    _t: key => key,
  };
  vm.runInNewContext(bindSource, context).call(panel, { querySelectorAll: () => [bubble] });
  const dispatch = (name, overrides = {}) => listeners.get(name)({
    pointerType: desktop ? 'mouse' : 'touch',
    button: 0,
    clientX: 20,
    clientY: 20,
    target: { closest: () => null },
    preventDefault() {},
    ...overrides,
  });
  return { copied, menus, timers, dispatch };
}

test('desktop mouse selects without copying; right click opens the message menu', async () => {
  const { copied, menus, timers, dispatch } = fixture(true);
  dispatch('pointerdown');
  assert.equal(timers.size, 0);
  await dispatch('click');
  assert.deepEqual(copied, []);
  dispatch('contextmenu', { button: 2 });
  assert.deepEqual(menus, ['open']);
});

test('mobile tap copies the whole message and touch hold opens its menu', async () => {
  const { copied, menus, timers, dispatch } = fixture(false);
  dispatch('pointerdown');
  dispatch('pointerup');
  await dispatch('click');
  assert.deepEqual(copied, ['whole message']);
  dispatch('pointerdown');
  const hold = [...timers.values()].find(timer => timer.delay === 700);
  assert.ok(hold);
  hold.callback();
  await dispatch('click');
  assert.deepEqual(menus, ['open']);
  assert.deepEqual(copied, ['whole message']);
});
