import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const png=readFileSync(new URL('../public/brand/apple-touch-icon.png',import.meta.url));

test('Apple touch icon exists as a branded 180 by 180 PNG',()=>{
  assert.ok(png.length>1000);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),180);
  assert.equal(png.readUInt32BE(20),180);
});
test('Safari home-screen shortcut uses the dedicated icon and FlexPass name',()=>{
  assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="%BASE_URL%brand\/apple-touch-icon\.png\?v=2"\s*\/>/);
  assert.match(html,/<meta name="apple-mobile-web-app-title" content="FlexPass"\s*\/>/);
  assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="%BASE_URL%brand\/flexpass-monogram\.svg"\s*\/>/);
});
