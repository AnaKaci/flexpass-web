import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const css=readFileSync(new URL('../src/quiet-home.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('homepage header has a compact, scoped height and logo',()=>{
  assert.ok(css.includes('.site-header.quiet-public-header .header-row{\n  min-height:94px;'));
  assert.ok(css.includes('.site-header.quiet-public-header .official-brand-link .official-brand-logo-full{\n  width:115px;\n  height:82px;'));
  assert.ok(css.includes('@media(max-width:1050px)'));
  assert.ok(css.includes('min-height:86px;'));
  assert.ok(css.includes('@media(max-width:600px)'));
  assert.ok(css.includes('min-height:76px;'));
});
test('only homepage gets compact header styling',()=>{
  assert.ok(app.includes("home?'quiet-public-header':''"));
  assert.ok(app.includes('return <PublicLayout home><main className="home-page quiet-home">'));
  assert.ok(app.includes('return <PublicLayout hideHeader><AuthFrame>'));
  assert.ok(!css.includes('.site-header .header-row{min-height:94px'));
});
