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
  assert.doesNotMatch(app,/<div className="quiet-pilot-note" role="note">/);
});

test('editorial marketing visuals come from the existing bundled generated images',()=>{
  for(const image of ['hero-spa.webp','hero-pilates.webp','hero-padel.webp']){
    assert.ok(home.includes(image),'Missing '+image);
  }
  assert.doesNotMatch(home,/Imagery is illustrative and does not represent specific FlexPass partner venues/);
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

test('collection cards form a descending staircase on desktop and tablet',()=>{
  assert.match(storyStyles,/\.home-collection-grid\{[^}]*align-items:start/s);
  assert.match(storyStyles,/\.home-collection-grid \.home-collection:nth-child\(2\)\{\s*margin-top:clamp\(65px,7vw,112px\)/);
  assert.match(storyStyles,/\.home-collection-grid \.home-collection:nth-child\(3\)\{\s*margin-top:clamp\(130px,14vw,224px\)/);
  assert.match(storyStyles,/@media\(max-width:900px\)/);
});
test('mobile collection keeps swipeable cards aligned without vertical clipping',()=>{
  assert.match(storyStyles,/@media\(max-width:700px\)/);
  assert.match(storyStyles,/\.home-collection-grid \.home-collection:nth-child\(2\),\s*\.home-collection-grid \.home-collection:nth-child\(3\)\{margin-top:0\}/);
  assert.match(storyStyles,/scroll-snap-type:x mandatory/);
  assert.match(storyStyles,/object-fit:cover/);
});

test('homepage invitation uses the supplied people-free photo as a full-bleed background',()=>{
  const photo=readFileSync(new URL('../public/brand/home-invitation-yoga.webp',import.meta.url));
  assert.ok(photo.length>10000);
  assert.equal(photo.toString('ascii',0,4),'RIFF');
  assert.equal(photo.toString('ascii',8,12),'WEBP');
  assert.match(home,/className="home-editorial-invitation-photo"/);
  assert.match(home,/brand\/home-invitation-yoga\.webp/);
  assert.match(storyStyles,/\.home-editorial-invitation-photo\{[^}]*object-fit:cover/s);
  assert.match(storyStyles,/\.home-editorial-invitation::before\{[^}]*background:rgba\(7,45,48,\.68\)/s);
  assert.doesNotMatch(home,/Imagery is illustrative and does not represent specific FlexPass partner venues/);
});
