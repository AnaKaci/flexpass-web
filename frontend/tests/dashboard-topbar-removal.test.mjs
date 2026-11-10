import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/dashboard-sidebar.css',import.meta.url),'utf8');

test('all three workspaces share a dashboard without the former top banner',()=>{
  assert.ok(dashboard.includes('export function Dashboard({role}:{role:Role})'));
  assert.ok(dashboard.includes("role==='client'"));
  assert.ok(dashboard.includes("role==='partner'"));
  assert.ok(dashboard.includes("role==='admin'"));
  assert.ok(!dashboard.includes('<header className={`dash-topbar'));
  assert.ok(!dashboard.includes('dashboard-page-identity'));
  assert.ok(!dashboard.includes('Pilot environment'));
  assert.ok(!dashboard.includes('FlexPass / {role}'));
});

test('sidebar remains accessible and main workspace content is not removed',()=>{
  assert.ok(dashboard.includes('aria-label="Show sidebar"'));
  assert.ok(dashboard.includes('onClick={()=>setSidebarOpen(true)}'));
  assert.ok(dashboard.includes('className="dashboard-nav-opener"'));
  assert.ok(dashboard.includes('aria-label="Close navigation menu"'));
  assert.ok(dashboard.includes('className="dash-content"'));
  assert.ok(dashboard.includes('<EmployeeView'));
  assert.ok(dashboard.includes('<PartnerView'));
  assert.ok(dashboard.includes('<AdminView'));
  assert.ok(styles.includes('.dashboard-app-shell .dashboard-nav-opener{'));
});
