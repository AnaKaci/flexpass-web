import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=(name)=>readFileSync(new URL(name,import.meta.url),'utf8');
const home=read('../src/HomeStory.tsx');
const app=read('../src/App.tsx');
const storyStyles=read('../src/home-story.css');
const footerStyles=read('../src/footer.css');

test('homepage story is included without replacing the existing carousel',()=>{
  assert.match(app,/<LuminaHero\s*\/>/);
  assert.match(app,/<HomeStory\s*\/>/);
  assert.match(app,/<div className="quiet-pilot-note" role="note">/);
});

test('editorial marketing visuals come from the existing bundled generated images',()=>{
  for(const image of ['hero-spa.webp','hero-pilates.webp','hero-padel.webp']){
    assert.ok(home.includes(image),'Missing '+image);
  }
  assert.match(home,/Imagery is illustrative/);
  assert.match(home,/loading="lazy"/);
  assert.match(storyStyles,/@media\(max-width:700px\)/);
});

test('home marketing retains truthful bank verification and precisely two public login choices',()=>{
  assert.match(home,/Credits are issued once payment has been verified/);
  assert.match(home,/to="\/login\/client"/);
  assert.match(home,/to="\/login\/business"/);
  assert.doesNotMatch(home,/to="\/admin/);
  assert.doesNotMatch(home,/testimonial|five.star|instant payment/i);
});

test('footer rows stretch to full width so navigation reaches the right edge',()=>{
  assert.match(footerStyles,/\.flexpass-footer \.footer-inner\{[^}]*align-items:stretch/s);
  assert.match(footerStyles,/\.flexpass-footer \.flexpass-footer-top\{[^}]*width:100%/s);
  assert.match(footerStyles,/\.flexpass-footer \.flexpass-footer-bottom\{[^}]*width:100%/s);
  assert.match(footerStyles,/\.flexpass-footer \.footer-right\{[^}]*justify-self:end/s);
});
