const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../custom_components/sms_gammu_viewer/frontend/panel.js'), 'utf8');
function fixture(confirm = () => true) {
  const pieces = [
    ['  _brandLogoFor(contact)', '  _brandCandidates('],
    ['  _isAlphaTag(number)', '  _esc(s)'],
    ['  _isBrandChat(contact)', '  _updateMenuBtn('],
    ['  async _openBrandLogoPicker(contact)', '  _renderBrandLogoPicker(query)'],
    ['  _avatarFor(contact)', '  _contactMethodValue('],
    ['  _contactAvatar(contact,', '  async _contactForNumber('],
  ];
  const methods = pieces.map(([start, end]) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))).join('\n');
  const Panel = vm.runInNewContext(`(class { ${methods} })`, { confirm });
  const p = new Panel();
  p._status = { use_brand_logos: true };
  p._folderOptions = { brands_manual: [], brands_excluded: [] };
  p._phonebook = [];
  p._brandCatalog = [{ name: 'Bank', svgUrl: 'bank.svg', localUrl: '/bank.svg' }];
  p._brandAssignments = {};
  p._esc = value => value;
  p._t = value => value;
  p._brandAssetSrc = value => value;
  p._ensureBrandCatalog = async () => {};
  p._renderBrandLogoPicker = () => {};
  return p;
}
test('numeric brands require manual membership and an explicit icon', () => {
  const p = fixture();
  const c = { number: '+79990000000', contact_name: 'Bank', brand_icon_data: 'data:icon' };
  assert.equal(p._brandLogoFor(c), '');
  p._folderOptions.brands_manual.push(c.number);
  assert.equal(p._brandLogoFor(c), 'data:icon');
  assert.equal(p._isInBrandsFolder(c), true);
  assert.equal(p._isBrandChat(c), false); // Removing it from Brands must work.
  assert.equal(p._brandLogoFor({ ...c, brand_icon_data: '' }), '');
  assert.equal(p._brandLogoFor({ ...c, brand_icon_data: '', brand_logo_url: 'bank.svg' }), '/bank.svg');
  p._folderOptions.brands_excluded.push(c.number);
  assert.equal(p._brandLogoFor(c), '');
  assert.equal(p._isInBrandsFolder(c), false);
});
test('saved contact needs confirmation; phonebook photo wins', async () => {
  const p = fixture(() => false);
  const c = { number: '+79990000000', _saved: true, avatar: 'data:person', brand_icon_data: 'data:brand' };
  await p._openBrandLogoPicker(c);
  assert.equal(p._brandPickerContact, undefined);
  p._folderOptions.brands_manual.push(c.number);
  assert.match(p._contactAvatar(c), /data:person/);
  assert.doesNotMatch(p._contactAvatar(c), /data:brand/);
  await p._openBrandLogoPicker({ ...c, _saved: false });
  assert.equal(p._brandPickerContact._saved, false);
});
