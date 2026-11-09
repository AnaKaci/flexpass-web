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
