import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const src=readFileSync(new URL('../src/CreditShop.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');

test('Client Credit Shop renders live package prices, credits and names',()=>{
  assert.match(src,/products\.map\(\(product,index\)=>/);
  assert.match(src,/product\.name/);
  assert.match(src,/product\.credits/);
  assert.match(src,/money\(product\.price_cents\)/);
});
test('purchase action remains tied to the real product order flow',()=>{
  assert.match(src,/onClick=\{\(\)=>onPurchase\(product\)\}/);
  assert.match(dashboard,/if\(section==='shop'\)return <CreditShop/);
  assert.match(dashboard,/onPurchase=\{onPurchase\}/);
});
test('the demo payment notice keeps the transfer verification limitation clear',()=>{
  assert.match(src,/pending bank transfer order/);
  assert.match(src,/independent bank verification/);
  assert.match(src,/No payment is collected/);
  assert.doesNotMatch(src,/pay now|instant bank|card charged/i);
});
