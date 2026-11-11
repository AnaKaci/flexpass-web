import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const profile=readFileSync(new URL('../src/ClientProfile.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/client-profile.css',import.meta.url),'utf8');
const menu=readFileSync(new URL('../src/ProfileMenu.tsx',import.meta.url),'utf8');
const menuStyles=readFileSync(new URL('../src/profile-menu.css',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
const backend=readFileSync(new URL('../../backend/app.py',import.meta.url),'utf8');

test('Client account menu opens My profile above the existing Sign out option',()=>{
  assert.ok(menu.includes("user.role==='client'&&onProfile&&<button"));
  assert.ok(menu.includes('className="sidebar-profile-go-profile"'));
  assert.ok(menu.includes('<span>My profile</span>'));
  assert.ok(menu.indexOf('className="sidebar-profile-go-profile"')<menu.indexOf('className="sidebar-profile-sign-out"'));
  assert.ok(menu.includes("onClick={()=>{setOpen(false);onProfile()}}"));
  assert.ok(menu.includes('className="sidebar-profile-sign-out" onClick={onSignOut}'));
  assert.ok(menuStyles.includes('.dashboard-app-shell .dashboard-sidebar .sidebar-profile-go-profile{'));
  assert.ok(dashboard.includes("onProfile={role==='client'?()=>changeSection('profile'):undefined}"));
});

test('Client profile is URL addressable, not an extra primary navigation item',()=>{
  assert.ok(types.includes("| 'profile';"));
  assert.ok(dashboard.includes("role==='client'&&routeSection==='profile'"));
  assert.ok(dashboard.includes("role==='client'&&next==='profile'"));
  assert.ok(dashboard.includes("role==='client'&&routeSection==='profile'"));
  assert.ok(backend.includes("'client': {'overview', 'shop', 'discover', 'orders', 'bookings', 'wallet', 'notifications', 'profile'}"));
  const nav=dashboard.slice(dashboard.indexOf('const menu:'),dashboard.indexOf('function Table('));
  assert.ok(!nav.includes("['profile',"));
  const map=backend.slice(backend.indexOf('DASHBOARD_SECTIONS ='),backend.indexOf("@app.get('/client/{section}')"));
  assert.ok(!map.includes("'partner': {'profile'"));
  assert.ok(!map.includes("'admin': {'profile'"));
  assert.ok(dashboard.includes("<ClientProfile user={user} summary={s}"));
});

test('Profile displays actual user, member and visit data without placeholders',()=>{
  for(const field of ['user.full_name','user.email','user.status','user.id','summary.balance','summary.personal_account','orders.length']){
    assert.ok(profile.includes(field),field);
  }
  assert.ok(profile.includes("bookings.filter(item=>item.status==='BOOKED').length"));
  assert.ok(profile.includes("bookings.filter(item=>item.status==='CHECKED_IN').length"));
  assert.ok(profile.includes('recentBookings.map(booking=>'));
  assert.ok(profile.includes('recentLedger.map(row=>'));
  assert.ok(profile.includes('booking.partner'));
  assert.ok(profile.includes('row.amount'));
  assert.ok(profile.includes("No bookings recorded on your account yet."));
  assert.ok(profile.includes("No credit transactions recorded yet."));
  assert.ok(!profile.includes('Math.random('));
  assert.ok(!profile.includes('faker'));
  assert.ok(!profile.includes('password'));
});

test('Profile navigation leads to existing wallet, bookings, orders and discovery pages',()=>{
  for(const page of ["wallet","bookings","orders","shop","discover"]){
    assert.ok(profile.includes("onSection('"+page+"')"),page);
  }
  assert.ok(dashboard.includes("get<EmployeeSummary>('/client/summary')"));
  assert.ok(dashboard.includes("get<Booking[]>('/client/bookings')"));
  assert.ok(dashboard.includes("get<LedgerRow[]>('/client/ledger')"));
  assert.ok(dashboard.includes("get<ClientOrder[]>('/client/orders')"));
});

test('Client profile remains on-brand and responsive without affecting other portals',()=>{
  for(const token of ['--teal','--ivory','--burgundy','--blush','--paper','--warm-gray']){
    assert.ok(styles.includes('var('+token+')'),token);
  }
  assert.ok(styles.includes("font:500 46px/1 'Bodoni Moda'"));
  assert.ok(styles.includes('@media(max-width:860px)'));
  assert.ok(styles.includes('@media(max-width:500px)'));
  assert.ok(styles.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(styles.includes('.client-profile-page'));
  assert.ok(!styles.includes('.home-page'));
  assert.ok(!styles.includes('.auth-photo-stage'));
  assert.ok(!styles.includes('.partner-'));
  assert.ok(!styles.includes('.admin-'));
});
