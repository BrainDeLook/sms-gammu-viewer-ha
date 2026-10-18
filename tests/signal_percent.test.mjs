import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signalPercent } from '../custom_components/sms_gammu_viewer/frontend/signal_percent.mjs';

test('only finite bounded numbers reach signal markup and CSS', () => {
  for (const value of ['<img src=x onerror=alert(1)>', '10; background:url(x)', Infinity, NaN, null, undefined, '', true, [], {}]) {
    assert.equal(signalPercent(value), 0);
    assert.equal(signalPercent(value, '?'), '?');
  }
  assert.equal(signalPercent('87'), 87);
  assert.equal(signalPercent(45.5), 45.5);
  assert.equal(signalPercent(200), 100);
  assert.equal(signalPercent(-10), 0);
});
