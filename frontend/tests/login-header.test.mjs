import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('all auth routes omit the announcement strip and site-wide navigation header',()=>{
  assert.match(app,/function PublicLayout\(\{children,home=false,hideHeader=false\}/);
  assert.match(app,/!home&&!hideHeader&&<div className="top-strip">/);
  assert.match(app,/!hideHeader&&<header className=/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame>/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">CREATE YOUR FLEXPASS ACCOUNT/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">ACCOUNT ACTIVATION/);
});

test('homepage and other public pages retain their existing layout',()=>{
  assert.match(app,/return <PublicLayout home><main className="home-page quiet-home">/);
  assert.match(app,/return <PublicLayout><main className="content-page editorial-content-page">/);
  assert.match(app,/<BrandLogo variant="monogram" className="auth-official-monogram"/);
  assert.match(app,/login-pilates\.webp/);
});
