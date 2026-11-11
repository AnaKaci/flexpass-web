import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const explore=readFileSync(new URL('../src/ClientExplore.tsx',import.meta.url),'utf8');
const shop=readFileSync(new URL('../src/CreditShop.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const exploreCss=readFileSync(new URL('../src/client-explore.css',import.meta.url),'utf8');
const shopCss=readFileSync(new URL('../src/credit-shop.css',import.meta.url),'utf8');

test('Client Explore eyebrow labels retain their wording without decorative numbering',()=>{
  assert.ok(explore.includes('className="client-explore-section-kicker">DISCOVER</span>'));
  assert.ok(explore.includes('className="client-explore-section-kicker">EXPERIENCE LIST</span>'));
  assert.ok(!explore.includes('01 / DISCOVER'));
  assert.ok(!explore.includes('02 / EXPERIENCE LIST'));
  assert.ok(explore.includes('client-explore-search'));
  assert.ok(explore.includes('client-explore-categories'));
  assert.ok(exploreCss.includes('.client-explore-section-kicker{'));
});

test('Credit Shop keeps the section eyebrow and original styling without its index',()=>{
  assert.ok(shop.includes('className="credit-shop-section-index">YOUR OPTIONS</span>'));
  assert.ok(!shop.includes('01 / YOUR OPTIONS'));
  assert.ok(shopCss.includes('.credit-shop-section-index{'));
});

test('Login eyebrow labels remain but do not display sequence numbers',()=>{
  assert.ok(app.includes("eyebrow:'CLIENT ACCESS'"));
  assert.ok(app.includes("eyebrow:'PARTNER ACCESS'"));
  assert.ok(app.includes("eyebrow:'RESTRICTED / FLEXPASS OPERATIONS'"));
  assert.ok(!app.includes("eyebrow:'01 /"));
  assert.ok(!app.includes("eyebrow:'02 /"));
});

test('No numbered eyebrow copy remains in the updated views',()=>{
  for(const source of [explore,shop,app]){
    assert.doesNotMatch(source,/\b\d{2}\s*\/\s*(?:DISCOVER|EXPERIENCE LIST|YOUR OPTIONS|CLIENT ACCESS|PARTNER ACCESS)/);
  }
});
