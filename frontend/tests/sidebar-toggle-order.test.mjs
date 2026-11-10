import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/sidebar-motion.css',import.meta.url),'utf8');

test('the hamburger toggle is positioned before the FlexPass logo',()=>{
  const start=dashboard.indexOf('<div className="dashboard-sidebar-heading">');
  const end=dashboard.indexOf('</div>',start);
  assert.ok(start!==-1 && end>start);
  const heading=dashboard.slice(start,end);
  const toggle=heading.indexOf('<button type="button" className="dashboard-sidebar-close"');
  const logo=heading.indexOf('<Link className="logo dashboard-brand-link"');
  assert.ok(toggle!==-1 && logo!==-1 && toggle<logo);
  assert.ok(heading.includes('name="menu" size={18}'));
  assert.ok(!heading.includes('name="close"'));
  assert.ok(!heading.includes('name={sidebarOpen?'));
  assert.ok(heading.includes('onClick={()=>setSidebarOpen(open=>!open)}'));
  assert.ok(heading.includes('aria-label={sidebarOpen?"Collapse sidebar":"Expand sidebar"}'));
  assert.ok(heading.includes('variant="full" tone="ivory"'));
  assert.ok(heading.includes('variant="monogram" tone="ivory"'));
});

test('collapsed layout puts the menu toggle above the logo and styling stays on-brand',()=>{
  assert.ok(styles.includes('.dashboard-app-shell.sidebar-collapsed .dashboard-sidebar .dashboard-sidebar-heading{'));
  assert.ok(styles.includes('flex-direction:column;'));
  assert.ok(styles.includes('.dashboard-app-shell .dashboard-sidebar .dashboard-sidebar-close{'));
  assert.ok(styles.includes('border-radius:11px;'));
  assert.match(styles,/\.dashboard-app-shell \.dashboard-sidebar \.dashboard-sidebar-heading\{\s*justify-content:flex-start;\s*gap:24px;/);
  assert.match(styles,/@media\(min-width:761px\)\{\s*\.dashboard-app-shell\.sidebar-collapsed \.dashboard-sidebar \.dashboard-sidebar-heading\{\s*justify-content:center;\s*gap:24px;\s*min-height:101px;/);
  assert.ok(styles.includes('stroke-width:1.65;'));
  assert.ok(styles.includes('color:var(--ivory,#F5EFE4);'));
  assert.ok(styles.includes(':focus-visible'));
  assert.ok(styles.includes('prefers-reduced-motion:reduce'));
  assert.ok(dashboard.includes('className="side-nav"'));
  assert.ok(dashboard.includes('<ProfileMenu user={user}'));
  assert.ok(!styles.includes('.home-page'));
});

test('compact Client quote gives sidebar navigation room without losing brand or scrolling fallback',()=>{
  assert.ok(styles.includes('.dashboard-app-shell.sidebar-expanded .dashboard-client-sidebar .sidebar-client-quote{'));
  assert.ok(styles.includes("font:italic 400 19px/1.15 'Cormorant Garamond',Georgia,serif;"));
  assert.ok(styles.includes("font:600 9px/1.35 'Inter',sans-serif;"));
  assert.ok(styles.includes('@media(max-height:840px){'));
  assert.ok(styles.includes('font-size:18px;'));
  assert.ok(styles.includes('.dashboard-app-shell.sidebar-expanded .dashboard-sidebar .side-label{'));
  assert.ok(styles.includes('overflow-y:auto;'));
  assert.ok(!styles.includes('font-family:'));
  assert.ok(!styles.includes('.home-page'));
});
