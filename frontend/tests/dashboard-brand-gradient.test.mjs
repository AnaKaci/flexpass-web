import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const css=readFileSync(new URL('../src/dashboard-gradient.css',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const brand=readFileSync(new URL('../src/brand.css',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');

test('Client, Partner and Admin dashboards share the supplied lily-and-silk background',()=>{
  for(const variable of ['--ivory','--paper','--blush','--mist']){
    assert.ok(brand.includes(variable+':'),'missing FlexPass brand token '+variable);
  }
  assert.match(css,/\.dashboard-app-shell \.dashboard-main\{[\s\S]*?background-image:/);
  assert.ok(css.includes("url('./assets/blush-silk-lily-dashboard.webp')"));
  assert.ok(!css.includes('.dashboard-app-shell:has(> .dashboard-client-sidebar) .dashboard-main{'),
    'client-only background overrides would hide the shared artwork');
  assert.ok(!css.includes('.quiet-home'));
  assert.ok(!css.includes('.auth-photo-stage'));
  const image=readFileSync(new URL('../src/assets/blush-silk-lily-dashboard.webp',import.meta.url));
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
  assert.ok(image.length>3000,'background should contain actual image pixels');
});

test('dashboard background is not covered by ivory content or mobile navigation strips',()=>{
  assert.ok(css.includes('.dashboard-app-shell .dashboard-main .dash-content,'));
  assert.ok(css.includes('.dashboard-app-shell .dashboard-main .dashboard-nav-opener{'));
  assert.ok(css.includes('background:transparent;'));
  assert.ok(dashboard.includes('className="dash-main dashboard-main"'));
  const names=[...entry.matchAll(/import '\.\/(.*?)\.css';/g)].map(m=>m[1]);
  assert.ok(names.indexOf('dashboard-gradient')>names.indexOf('auth-login'),'gradient must load after global and auth styles');
  assert.deepEqual(names.slice(-2),['dashboard-gradient','sidebar-motion'],'only scoped sidebar motion may follow dashboard gradient');
});
