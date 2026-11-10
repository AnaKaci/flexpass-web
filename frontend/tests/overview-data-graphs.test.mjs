import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const overview=readFileSync(new URL('../src/OverviewGraphs.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/overview-graphs.css',import.meta.url),'utf8');
const chart=readFileSync(new URL('../src/LogMiniChart.tsx',import.meta.url),'utf8');

test('Business Overview mixes a line graph and donut calculated from owned bookings',()=>{
  assert.ok(dashboard.includes('<PartnerOverviewGraphs bookings={data.bookings}/>'));
  assert.ok(overview.includes("activityBuckets(bookings.map(booking=>booking.created_at),'day',today)"));
  assert.ok(overview.includes("activityBuckets(bookings.map(booking=>booking.checked_in_at),'day',today)"));
  assert.ok(overview.includes('<TrendLineChart title="Bookings and completed visits"'));
  assert.ok(overview.includes('values:reservations.map(item=>item.count)'));
  assert.ok(overview.includes('values:visits.map(item=>item.count)'));
  for(const status of ['BOOKED','CHECKED_IN','CANCELLED']){
    assert.ok(overview.includes(`booking.status==='${status}'`),status);
  }
  assert.ok(overview.includes('<BookingStatusDonut items={statuses}/>'));
  assert.ok(overview.includes('conic-gradient(var(--teal)'));
  assert.ok(overview.includes(":'var(--mist)'"),'empty donut must not imply nonexistent bookings');
  assert.ok(!overview.includes('Math.random('));
  assert.ok(!overview.includes('fetch('));
});

test('Admin Overview uses line series for existing monthly counts and bars for categories',()=>{
  assert.ok(dashboard.includes('<AdminOverviewGraphs analytics={data.adminAnalytics}/>'));
  assert.ok(dashboard.includes("get<AdminAnalytics>('/admin/analytics')"));
  assert.ok(overview.includes('const monthly=analytics?.monthly||[];'));
  assert.ok(overview.includes("activityBuckets([],'month',today,monthly.map(item=>({period:item.period,count:item.bookings})))"));
  assert.ok(overview.includes("activityBuckets([],'month',today,monthly.map(item=>({period:item.period,count:item.visits})))"));
  assert.ok(overview.includes("activityBuckets([],'month',today,monthly.map(item=>({period:item.period,count:item.orders})))"));
  assert.ok(overview.includes('<TrendLineChart title="Bookings, visits and orders"'));
  assert.ok(overview.includes('(analytics?.categories||[])'));
  assert.ok(overview.includes('item.bookings>0'));
  assert.ok(overview.includes('labels[item.name as Group]||item.name'));
  assert.ok(overview.includes('<RecordBreakdown items={categories}'));
  assert.ok(overview.includes('No experience bookings recorded yet.'));
  assert.ok(overview.includes('if(total===0)'));
});

test('Line graph is accessible and visualizes only actual values in each bucket',()=>{
  assert.ok(overview.includes('const yAt=(count:number)=>bottom-count/max*(bottom-top)'));
  assert.ok(overview.includes('const d=points.map('));
  assert.ok(overview.includes('<path className="flexpass-overview-line-path"'));
  assert.ok(overview.includes('tabIndex={0}'));
  assert.ok(overview.includes('role="img"'));
  assert.ok(overview.includes('aria-label={'));
  assert.ok(overview.includes('<title>{'));
  assert.ok(overview.includes('No activity recorded in this period.'));
  assert.ok(overview.includes("range=\"Last 14 days\""));
  assert.ok(overview.includes('range="Last 6 months"'));
  assert.ok(!overview.includes('seed'));
  assert.ok(!overview.includes('new Date().getTime()'));
});

test('Donut and comparisons keep real status and category totals available in text',()=>{
  assert.ok(overview.includes('const total=items.reduce((sum,item)=>sum+item.count,0)'));
  assert.ok(overview.includes('items[0].count/total*100'));
  assert.ok(overview.includes('(items[0].count+items[1].count)/total*100'));
  assert.ok(overview.includes('role="listitem" className="flexpass-overview-donut-legend-row"'));
  assert.ok(overview.includes('item.label} ${item.count}'));
  assert.ok(overview.includes('role="list" aria-label="Recorded counts by category"'));
  assert.ok(overview.includes('role="img" aria-label={'));
  assert.ok(css.includes('width:var(--flexpass-bar-fill)'));
});

test('Overview visualization changes do not alter other screens or the shared Notifications list',()=>{
  const business=dashboard.slice(dashboard.indexOf('function PartnerView('),dashboard.indexOf('function AdminView('));
  const admin=dashboard.slice(dashboard.indexOf('function AdminView('));
  assert.ok(business.includes('PartnerOverviewGraphs'));
  assert.ok(admin.includes('AdminOverviewGraphs'));
  assert.ok(business.includes('Partner guidance'));
  assert.ok(business.includes('Manage your sessions'));
  assert.ok(admin.includes('Latest payment requests'));
  assert.ok(admin.includes('Operational snapshot'));
  assert.ok(admin.includes('<AdminOverviewInsights clients={data.clients}'));
  assert.ok(chart.includes('Activity from records currently loaded'));
  const notify=dashboard.slice(dashboard.indexOf('function NotificationView('),dashboard.indexOf('const ERROR_MESSAGE='));
  assert.ok(!notify.includes('LogMiniChart'));
  assert.ok(!notify.includes('OverviewGraphs'));
});

test('All three chart types use the FlexPass palette, responsive layout, and reduced motion fallback',()=>{
  for(const className of ['flexpass-overview-graphs-grid','flexpass-overview-line-svg','flexpass-overview-donut','flexpass-overview-breakdown']){
    assert.ok(css.includes('.'+className),className);
  }
  assert.ok(css.includes('grid-template-columns:minmax(0,1.7fr) minmax(260px,.85fr)'));
  assert.ok(css.includes('conic-gradient')===false,'donut data is computed from real records in TSX');
  assert.ok(css.includes('@media(max-width:620px)'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('stroke-dashoffset:0'));
  for(const token of ['--teal','--teal-dark','--burgundy','--mist','--warm-gray','--paper']){
    assert.ok(css.includes(`var(${token})`),token);
  }
  assert.ok(!css.includes('.home-page'));
  assert.ok(!css.includes('.auth-photo-stage'));
  assert.ok(!css.includes('font-family:'));
});
