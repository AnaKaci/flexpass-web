import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/auth-login.css',import.meta.url),'utf8');

test('Pilates photo is included as a valid local WebP login background',()=>{
  const bytes=readFileSync(new URL('../public/brand/login-pilates.webp',import.meta.url));
  assert.ok(bytes.length>20000);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.match(app,/login-pilates\.webp/);
  assert.match(app,/<AuthFrame loginPortal=\{portal\}>/);
});

test('role-specific login forms do not reuse the same browser autofill identifiers',()=>{
  assert.match(app,/key=\{portal\} className="stack"/);
  assert.match(app,/name=\{`flexpass-\$\{portal\}-username`\}/);
  assert.match(app,/name=\{`flexpass-\$\{portal\}-password`\}/);
  assert.match(app,/autoComplete=\{`section-flexpass-\$\{portal\} username`\}/);
  assert.match(app,/autoComplete=\{`section-flexpass-\$\{portal\} current-password`\}/);
  assert.match(app,/useEffect\(\(\)=>\{setEmail\(''\);setPassword\(''\);setFormError\(''\);\},\[portal\]\)/);
});

test('blurred photographic aside remains visible on desktop and mobile login layouts',()=>{
  assert.match(styles,/\.auth-page\.auth-login-layout \.auth-editorial-aside\{[^}]*display:block/s);
  assert.match(styles,/\.auth-page\.auth-login-layout \.auth-editorial-aside img\{[^}]*filter:blur\(3\.5px\)/s);
  assert.match(styles,/@media\(max-width:700px\)/);
  assert.match(styles,/\.auth-page\.auth-login-layout \.auth-editorial-aside\{[^}]*display:block/s);
  assert.match(styles,/\.auth-page\.auth-login-layout \.auth-card-refined\{[^}]*background:#FFFCF7/s);
});

test('sign-in routes and real authentication API are unchanged',()=>{
  assert.match(app,/<Route path="\/login\/client" element=\{<Login portal="client"\/>\}/);
  assert.match(app,/<Route path="\/login\/business" element=\{<Login portal="partner"\/>\}/);
  assert.match(app,/<Route path="\/admin\/login" element=\{<Login portal="admin"\/>\}/);
  assert.match(app,/await signIn\(email,password,portal\)/);
});
