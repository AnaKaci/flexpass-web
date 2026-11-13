import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/home-story.css',import.meta.url),'utf8');

test('philosophy retains the brand copy and adds two natural editorial photographs',()=>{
  assert.match(app,/A healthier, happier <em>everyday\.<\/em>/);
  assert.match(app,/Make space for what matters\./);
  assert.match(app,/quiet-statement-portrait/);
  assert.match(app,/quiet-statement-landscape/);
  assert.ok(app.includes('photo-1772268485810-29dc9d231f26'));
  assert.ok(app.includes('photo-1527604234320-e7f7bb99bc6c'));
  assert.ok(css.includes('.quiet-home .quiet-statement-inner.quiet-statement-editorial'));
  assert.ok(css.includes('grid-template-columns:'));
});

test('philosophy serves mobile-sized photos while retaining a 4K option and lazy loading',()=>{
  const section=app.slice(app.indexOf('<section className="quiet-statement"'),app.indexOf('</section>',app.indexOf('<section className="quiet-statement"')));
  assert.equal((section.match(/loading="lazy"/g)||[]).length,2);
  assert.equal((section.match(/decoding="async"/g)||[]).length,2);
  assert.equal((section.match(/fetchPriority="low"/g)||[]).length,2);
  assert.equal((section.match(/3840w/g)||[]).length,2);
  assert.equal((section.match(/srcSet="/g)||[]).length,2);
  assert.equal((section.match(/sizes="/g)||[]).length,2);
  assert.ok(css.includes('@media(max-width:700px)'));
  assert.match(css,/\.quiet-home \.quiet-statement-gallery img\{[^}]*object-fit:cover/s);
});
