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
  assert.ok(app.includes('className="auth-photo-backdrop" aria-hidden="true"'));
  assert.ok(app.includes('<img src={photoUrl} alt=""/>'));
  assert.ok(!app.includes('className="auth-photo-panel"'));
});

test('same image-led frame is shared by login, signup and activation',()=>{
  assert.match(app,/function AuthFrame\(\{children\}:\{children:ReactNode\}\)/);
  assert.match(app,/className="auth-page gateway-auth auth-photo-stage"/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame>/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">CREATE YOUR FLEXPASS ACCOUNT/);
  assert.match(app,/return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">ACCOUNT ACTIVATION/);
  assert.ok(!app.includes('auth-editorial-layout'));
});

test('Pilates image fills the entire auth viewport behind the centered form card',()=>{
  assert.ok(styles.includes('.auth-page.auth-photo-stage{'));
  assert.ok(styles.includes('min-height:100svh;'));
  assert.ok(styles.includes('width:100%;\n  max-width:none;'));
  assert.ok(styles.includes('> .auth-photo-backdrop{'));
  assert.ok(styles.includes('object-fit:cover;'));
  assert.ok(styles.includes('filter:blur(1.25px);'));
  assert.ok(styles.includes('> .auth-card-refined{'));
  assert.ok(styles.includes('z-index:2;'));
  assert.ok(styles.includes('  justify-content:center;'));
  assert.ok(!styles.includes('  justify-content:flex-start;'));
  assert.ok(!styles.includes('grid-template-columns:'));
  assert.ok(!styles.includes('.auth-photo-panel'));
  assert.ok(styles.includes('@media(max-width:760px)'));
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

test('auth footer touches photograph with no legacy beige margin strip',()=>{
  assert.match(styles,/\.auth-page\.auth-photo-stage \+ \.foot\.flexpass-footer\{\s*margin-top:0;/);
  assert.match(app,/<footer className=\{`foot flexpass-footer/);
  assert.match(app,/return <PublicLayout home><main className="home-page quiet-home">/);
});
