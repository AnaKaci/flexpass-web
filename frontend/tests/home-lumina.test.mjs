import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {test} from 'node:test';

const src=new URL('../src/LuminaHero.tsx',import.meta.url);
const app=new URL('../src/App.tsx',import.meta.url);
const code=readFileSync(src,'utf8');

test('generated local WebP assets are valid and packaged in public brand directory',()=>{
  for(const name of ['spa','pilates','yoga','padel']){
    const file=new URL(`../public/brand/hero-${name}.webp`,import.meta.url);
    const bytes=readFileSync(file);
    assert.ok(statSync(file).size>10000,`hero-${name}.webp is unexpectedly small`);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(code.includes(`hero-${name}.webp`),`hero-${name}.webp is not referenced by hero`);
  }
});

test('home integrates the interactive hero with exactly four lifestyle categories',()=>{
  assert.ok(readFileSync(app,'utf8').includes('<LuminaHero/>'));
  assert.match(code,/const EXPERIENCES=\[/);
  assert.equal((code.match(/image:'hero-[a-z]+\.webp'/g)||[]).length,4);
});

test('hero keeps only the two existing Client and Business login routes',()=>{
  const links=code.match(/to="\/login\/[a-z]+"/g)||[];
  assert.deepEqual(links.sort(),['to="/login/business"','to="/login/client"']);
  assert.match(code,/aria-pressed=/);
  assert.match(code,/prefers-reduced-motion/);
  assert.match(code,/visibilitychange/);
  assert.doesNotMatch(code,/https:\/\//); // no remote image/script dependencies
});

test('decorative slide counter is removed without disabling interactive navigation',()=>{
  assert.doesNotMatch(code,/lumina-hero-index/);
  assert.match(code,/lumina-hero-navigation/);
  assert.match(code,/onClick=\{\(\)=>select\(index\)\}/);
});

test('carousel navigation displays titles without numbered labels',()=>{
  assert.doesNotMatch(code,/lumina-nav-number/);
  assert.match(code,/lumina-nav-text/);
  assert.match(code,/aria-pressed=\{active===index\}/);
});

test('carousel images cover the entire hero without stretching on every screen size',()=>{
  const css=readFileSync(new URL('../src/lumina-responsive.css',import.meta.url),'utf8');
  assert.match(css,/\.quiet-home \.lumina-hero-media\{[^}]*position:absolute;[^}]*inset:0;/s);
  assert.match(css,/\.quiet-home \.lumina-hero-photo\{[^}]*width:100%;[^}]*height:100%;[^}]*object-fit:cover;/s);
  assert.doesNotMatch(css,/object-fit:contain/);
  assert.match(css,/\.quiet-home \.lumina-hero-nav-item\{[^}]*min-height:75px/s);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/background:transparent;/);
});

test('monogram is grouped closely with the hero headline in the content column',()=>{
  const logoIndex=code.indexOf('className="lumina-hero-identity"');
  const contentIndex=code.indexOf('className="lumina-hero-main"');
  const copyIndex=code.indexOf('className="lumina-hero-copy"');
  const mediaIndex=code.indexOf('className="lumina-hero-media"');
  assert.ok(copyIndex>=0 && copyIndex<logoIndex && logoIndex<contentIndex && contentIndex<mediaIndex);
  const css=readFileSync(new URL('../src/lumina-responsive.css',import.meta.url),'utf8');
  assert.match(css,/\.quiet-home \.lumina-hero-copy\{[^}]*gap:clamp\(15px,2\.5svh,27px\)/s);
});
