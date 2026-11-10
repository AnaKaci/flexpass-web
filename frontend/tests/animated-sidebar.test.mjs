import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const motion=readFileSync(new URL('../src/sidebar-motion.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const brand=readFileSync(new URL('../src/brand.css',import.meta.url),'utf8');

test('desktop sidebar stays mounted to animate both expanding and collapsing',()=>{
  assert.ok(dashboard.includes('id="dashboard-sidebar" className={`sidebar dashboard-sidebar'));
  assert.ok(!dashboard.includes('{sidebarOpen&&<aside'));
  assert.ok(dashboard.includes('setSidebarOpen(open=>!open)'));
  assert.ok(dashboard.includes('sidebar-expanded'));
  assert.ok(dashboard.includes('sidebar-collapsed'));
  assert.ok(motion.includes('width 300ms ease-in-out'));
  assert.ok(motion.includes('.dashboard-app-shell.sidebar-collapsed .dashboard-sidebar'));
  assert.ok(motion.includes('width:76px;'));
});

test('mobile sidebar slides in and out while backdrop fades',()=>{
  assert.ok(dashboard.includes('sidebarOpen?\'is-visible\':\'\''));
  assert.ok(dashboard.includes('aria-hidden={isNarrowScreen&&!sidebarOpen}'));
  assert.ok(dashboard.includes('isNarrowScreen&&!sidebarOpen&&<div className="dashboard-nav-opener">'));
  assert.ok(motion.includes('transform:translate3d(-105%,0,0)'));
  assert.ok(motion.includes('transform:translate3d(0,0,0)'));
  assert.ok(motion.includes('transition:transform 300ms ease-in-out'));
  assert.ok(motion.includes('.dashboard-sidebar-backdrop.is-visible'));
  assert.ok(motion.includes('prefers-reduced-motion:reduce'));
});

test('original FlexPass sidebar contents, theme and profile menu remain',()=>{
  for(const item of ['YOUR MEMBERSHIP','menu[role].map','dashboard-brand-link','sidebar-client-quote','ProfileMenu user={user}','side-link','side-ico','side-text','changeSection(name)']){
    assert.ok(dashboard.includes(item),item);
  }
  assert.ok(dashboard.includes('variant="full" tone="ivory"'));
  assert.ok(dashboard.includes('variant="monogram" tone="ivory"'));
  for(const color of ['--teal:#10565C','--ivory:#F5EFE4','--burgundy:#AA1350']){
    assert.ok(brand.includes(color),color);
  }
  assert.ok(!motion.includes('font-family:'));
  assert.ok(!motion.includes('background:#'));
  assert.ok(!motion.includes('.home-page'));
  assert.ok(!motion.includes('.auth-photo-stage'));
  const styles=[...main.matchAll(/import '\.\/(.*?)\.css';/g)].map(x=>x[1]);
  assert.equal(styles.at(-1),'sidebar-motion');
});
