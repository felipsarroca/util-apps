const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function app() {
  const context = vm.createContext({
    Intl, window: { addEventListener() {} }, document: { addEventListener() {} },
    localStorage: { getItem() { return null; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8'), context);
  return context;
}

test('separates household and personal products from food', () => {
  const context = app();
  for (const [name, category] of [
    ['GINGILACER Pasta dentífrica to', 'higiene personal'],
    ['BONPREU Paper higiènic humit i', 'higiene personal'],
    ['ARIEL Detergent en càpsules Fr', 'neteja de la llar'],
    ['BONPREU Aigua oxigenada', 'higiene personal'],
    ['PATO DISCOS Netejador wc disco', 'neteja de la llar'],
    ['BONPREU Hocadors', 'higiene personal'],
    ['GINGILACER Pasta dentifnca', 'higiene personal'],
    ['BONPREU Bosses esconbraries en', 'neteja de la llar'],
    ['BONPREU Paper de cuina', 'neteja de la llar'],
    ['CORNETTO Gelat de llimona', 'menjar'],
    ['LA ESPAÑOLA Olives farcides', 'menjar'],
    ['Cost de Servei', 'altres']
  ]) assert.equal(context.guessCategory(name), category, name);
});

test('accepts a decimal dot read as a dash without changing negative signs', () => {
  const context = app();
  const ticket = context.parseTicket('Detergent 8-99\nAjust detergent -1,25', 'receipt.png');
  assert.equal(ticket.items[0].price, 8.99);
  assert.equal(ticket.items[1].price, -1.25);
});

test('keeps olive products, ignores tax rows and groups only full matching names', () => {
  const context = app();
  const ticket = context.parseTicket([
    'Oli oliva 2.59', 'RANA HUERTA Raviolis farcits d 3.99',
    'RANA HUERTA Raviolis de ricot 3.99', 'Oli oliva 2.59',
    'Cost de Servei 5,95', 'TOTAL DESCOMPTES: -3.00', 'TOTAL : 16.11',
    "DESGLOSSAMENT D’IVA", 'IVA 4% 70.10 2.80 72.90'
  ].join('\n'), 'receipt.png');
  assert.equal(ticket.items.length, 4);
  assert.equal(ticket.items[0].price, 5.18);
  assert.equal(ticket.items[0].quantity, 2);
  assert.equal(ticket.items[3].price, 5.95);
});

test('remembers close OCR variants without matching unrelated products', () => {
  const context = app();
  vm.runInContext("productMap[normalizeKey('BONPREU Paper higiènic humit i')] = 'higiene personal'", context);
  assert.equal(context.fuzzySuggest('BONPREU Paper higienic humlt i').category, 'higiene personal');
  assert.equal(context.fuzzySuggest('BONPREU Paper de cuina'), null);
  vm.runInContext("productMap[normalizeKey('BONPREU Paper higienic humlt i')] = 'altres'", context);
  const items = [{ name: 'BONPREU Paper higienic humlt i' }];
  context.classifyItems(items);
  assert.equal(items[0].category, 'altres');
});

test('escapes names before inserting them into the interface', () => {
  const context = app();
  assert.ok(!context.itemRowHTML('1', 0, {name:'<img src=x onerror=alert(1)>', price:1, category:'altres'}).includes('<img'));
});
