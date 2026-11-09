import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/auth-login.css',import.meta.url),'utf8');

test('original Pilates photograph is bundled as a valid self-hosted WebP',()=>{
  const bytes=readFileSync(new URL('../public/brand/login-pilates.webp',import.meta.url));
  assert.ok(bytes.length>20000);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.match(app,/brand\/login-pilates\.webp/);
  assert.match(app,/<aside className="auth-photo-panel" style=\{\{backgroundImage:/);
});

test('same image-led frame is shared by login, signup and activation',()=>{
  assert.match(app,/function AuthFrame\(\{children\}:\{children:ReactNode\}\)/);
  assert.match(app,/className="auth-page gateway-auth auth-photo-stage"/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame>/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">CREATE YOUR FLEXPASS ACCOUNT/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">ACCOUNT ACTIVATION/);
  assert.ok(!app.includes('auth-editorial-layout'));
});

test('desktop grid contains two assigned columns and blurred visible photo',()=>{
  assert.match(styles,/\.auth-page\.auth-photo-stage\{[^}]*display:grid;[^}]*grid-template-columns:/s);
  assert.match(styles,/\.auth-page\.auth-photo-stage > \.auth-card-refined\{[^}]*grid-column:1;/s);
  assert.match(styles,/\.auth-page\.auth-photo-stage > \.auth-photo-panel\{[^}]*display:block;[^}]*grid-column:2;/s);
  assert.match(styles,/\.auth-page\.auth-photo-stage \.auth-photo-panel img\{[^}]*object-fit:cover;[^}]*filter:blur\(5px\)/s);
  assert.match(styles,/@media\(max-width:760px\)/);
  assert.match(styles,/\.auth-page\.auth-photo-stage > \.auth-photo-panel\{[^}]*order:-1;/s);
});

test('role-specific login autofill and real authentication are preserved',()=>{
  assert.match(app,/key=\{portal\} className="stack"/);
  assert.match(app,/name=\{`flexpass-\$\{portal\}-username`\}/);
  assert.match(app,/name=\{`flexpass-\$\{portal\}-password`\}/);
  assert.match(app,/autoComplete=\{`section-flexpass-\$\{portal\} username`\}/);
  assert.match(app,/autoComplete=\{`section-flexpass-\$\{portal\} current-password`\}/);
  for(const [route,portal] of [['/login/client','client'],['/login/business','partner'],['/admin/login','admin']]){
    assert.ok(app.includes(`<Route path="${route}" element={<Login portal="${portal}"/>`));
  }
  assert.match(app,/await signIn\(email,password,portal\)/);
});
