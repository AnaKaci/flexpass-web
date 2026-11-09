import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('all three login portals omit the public header and announcement bar',()=>{
  assert.match(app,/function PublicLayout\(\{children,home=false,hideHeader=false\}/);
  assert.match(app,/!home&&!hideHeader&&<div className="top-strip">/);
  assert.match(app,/!hideHeader&&<header className=/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame loginPortal=\{portal\}>/);
  for (const route of ['/login/client','/login/business','/admin/login']) {
    assert.ok(app.includes(`<Route path="${route}" element={<Login portal="`));
  }
});

test('normal public headers and login-brand visual are preserved elsewhere',()=>{
  assert.match(app,/return <PublicLayout home><main className="home-page/);
  assert.match(app,/return <PublicLayout><AuthFrame><div className="eyebrow">CREATE YOUR FLEXPASS ACCOUNT/);
  assert.match(app,/<BrandLogo variant="monogram" className="auth-official-monogram"/);
  assert.match(app,/login-pilates\.webp/);
});
