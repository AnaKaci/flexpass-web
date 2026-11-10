import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const css=readFileSync(new URL('../src/dashboard-gradient.css',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const brand=readFileSync(new URL('../src/brand.css',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');

test('six-stop dashboard gradient only uses existing FlexPass palette variables',()=>{
  for(const variable of ['--ivory','--paper','--blush','--mist']){
    assert.ok(brand.includes(variable+':'),'missing FlexPass brand token '+variable);
  }
  assert.match(css,/\.dashboard-app-shell \.dashboard-main\{\s*background:linear-gradient\(/);
  const stops=['var(--ivory) 0%','var(--paper) 20%','var(--blush) 40%','var(--mist) 60%','var(--blush) 80%','var(--ivory) 100%'];
  for(const stop of stops)assert.ok(css.includes(stop),'missing '+stop);
  assert.ok(css.includes('270deg'));
  assert.ok(!css.includes('.quiet-home'));
  assert.ok(!css.includes('.auth-photo-stage'));
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
