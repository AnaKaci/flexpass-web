import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const overview=readFileSync(new URL('../src/OverviewGraphs.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/overview-graphs.css',import.meta.url),'utf8');
const chart=readFileSync(new URL('../src/LogMiniChart.tsx',import.meta.url),'utf8');

test('Business Overview trends derive exclusively from partner booking records',()=>{
  assert.ok(dashboard.includes('<PartnerOverviewGraphs bookings={data.bookings}/>'));
  assert.ok(overview.includes('timestamps={bookings.map(booking=>booking.created_at)}'));
  assert.ok(overview.includes('timestamps={bookings.map(booking=>booking.checked_in_at)}'));
  for(const status of ['BOOKED','CHECKED_IN','CANCELLED']){
    assert.ok(overview.includes(`booking.status==='${status}'`),status);
  }
  assert.ok(overview.includes('No reservations to summarize yet.'));
  assert.ok(!overview.includes('Math.random('));
  assert.ok(!overview.includes('fetch('));
  assert.ok(!overview.includes('useEffect('));
});

test('Admin Overview trends and categories derive from the already loaded analytics API',()=>{
  assert.ok(dashboard.includes('<AdminOverviewGraphs analytics={data.adminAnalytics}/>'));
  assert.ok(dashboard.includes("get<AdminAnalytics>('/admin/analytics')"));
  assert.ok(overview.includes("const monthly=analytics?.monthly||[];"));
  assert.ok(overview.includes("(analytics?.categories||[])"));
  for(const field of ['bookings','visits','orders']){
    assert.ok(overview.includes(`count:item.${field}`),field);
  }
  assert.ok(overview.includes('item.bookings>0'));
  assert.ok(overview.includes('labels[item.name as Group]||item.name'));
  assert.ok(overview.includes('No experience bookings recorded yet.'));
  assert.ok(overview.includes('if(total===0)'));
  assert.ok(!overview.includes('seed'));
  assert.ok(!overview.includes('new Date().getTime()'));
});

test('Overview graphs are limited to the two Overview views and retain existing panels',()=>{
  const business=dashboard.slice(dashboard.indexOf('function PartnerView('),dashboard.indexOf('function AdminView('));
  const admin=dashboard.slice(dashboard.indexOf('function AdminView('));
  assert.ok(business.includes('PartnerOverviewGraphs'));
  assert.ok(admin.includes('AdminOverviewGraphs'));
  assert.ok(business.includes('Partner guidance'));
  assert.ok(business.includes('Manage your sessions'));
  assert.ok(admin.includes('Latest payment requests'));
  assert.ok(admin.includes('Operational snapshot'));
  assert.ok(admin.includes('<AdminOverviewInsights clients={data.clients}'));
  assert.ok(chart.includes("Activity from records currently loaded"));
  const notify=dashboard.slice(dashboard.indexOf('function NotificationView('),dashboard.indexOf('const ERROR_MESSAGE='));
  assert.ok(!notify.includes('LogMiniChart'));
  assert.ok(!notify.includes('OverviewGraphs'));
});

test('All overview chart styling uses existing FlexPass palette and supports small screens',()=>{
  assert.ok(css.includes('.flexpass-overview-graphs-grid'));
  assert.ok(css.includes('grid-template-columns:minmax(0,1.7fr) minmax(260px,.85fr)'));
  assert.ok(css.includes('@media(max-width:620px)'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('role="img"')===false);
  assert.ok(overview.includes('role="img" aria-label='));
  assert.ok(overview.includes('role="list"'));
  for(const color of ['--teal','--teal-dark','--burgundy','--mist','--warm-gray']){
    assert.ok(css.includes(`var(${color})`),color);
  }
  assert.ok(!css.includes('.home-page'));
  assert.ok(!css.includes('.auth-photo-stage'));
  assert.ok(!css.includes('font-family:'));
});
