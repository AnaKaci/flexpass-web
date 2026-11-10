import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const chart=readFileSync(new URL('../src/LogMiniChart.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/log-mini-chart.css',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const feedback=readFileSync(new URL('../src/PartnerFeedback.tsx',import.meta.url),'utf8');
const admin=readFileSync(new URL('../src/AdminOverviewInsights.tsx',import.meta.url),'utf8');

test('mini chart buckets only genuine provided dates or API aggregation counts',()=>{
  assert.ok(chart.includes('activityBuckets('));
  assert.ok(chart.includes('length=interval===\'day\'?14:6'));
  assert.ok(chart.includes('const byKey=new Map('));
  assert.ok(chart.includes('const bucket=byKey.get(key)'));
  assert.ok(chart.includes('if(bucket)bucket.count++'));
  assert.ok(chart.includes('if(bucket&&Number.isFinite(point.count)&&point.count>=0)bucket.count+=point.count'));
  assert.ok(chart.includes('if(!specialMonth&&(!date||!Number.isFinite(date.getTime())))continue'));
  assert.ok(chart.includes('Activity from records currently loaded'));
  assert.ok(!chart.includes('Math.random('));
  assert.ok(!chart.includes('setInterval('));
  assert.ok(!chart.includes('fetch('));
});

test('all existing time-stamped history views show mini charts with real records',()=>{
  for(const check of [
    'timestamps={data.ledger.map(item=>item.created_at)}',
    'timestamps={data.orders.map(item=>item.created_at)}',
    'timestamps={data.bookings.map(item=>item.created_at)}',
    'timestamps={data.audit.map(item=>item.at)}',
    'timestamps={data.invoices.map(item=>item.period)}',
    'timestamps={data.settlements.map(item=>item.period)}',
    'points={(report?.monthly||[]).map(item=>({period:item.period,count:item.bookings}))}',
    'points={(report?.monthly||[]).map(item=>({period:item.period,count:item.visits}))}',
    'points={(report?.monthly||[]).map(item=>({period:item.period,count:item.orders}))}'
  ])assert.ok(dashboard.includes(check),check);
  assert.ok(dashboard.includes('title="Wallet entry history"'));
  assert.ok(dashboard.includes('title="Booking activity"'));
  assert.ok(dashboard.includes('title="Reservation activity"'));
  assert.ok(dashboard.includes('title="Audit activity"'));
  assert.ok(dashboard.includes('title="Settlement periods"'));
  assert.ok(feedback.includes('timestamps={rows.map(item=>item.created_at)}'));
  assert.ok(admin.includes('timestamps={audit.map(item=>item.at)}'));
  assert.ok(!dashboard.includes('new Array(14).fill(Math.random()'));
});

test('mini chart is keyboard accessible, responsive and brand-scoped',()=>{
  assert.ok(chart.includes('role="group"'));
  assert.ok(chart.includes('tabIndex={0} role="img"'));
  assert.ok(chart.includes('aria-label={'));
  assert.ok(css.includes('animation:flexpass-log-rise'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('.flexpass-mini-chart-group'));
  for(const token of ['var(--teal)','var(--teal-dark)','var(--burgundy)','var(--mist)','var(--ivory)','var(--paper)','var(--warm-gray)']){
    assert.ok(css.includes(token),token);
  }
  assert.ok(!css.includes('.home-page'));
  assert.ok(!css.includes('.auth-photo-stage'));
});

test('all notification pages retain their list without mini charts',()=>{
  const start=dashboard.indexOf('function NotificationView(');
  const end=dashboard.indexOf('const ERROR_MESSAGE=',start);
  assert.ok(start!==-1&&end>start,'notification component should exist');
  const notificationView=dashboard.slice(start,end);
  assert.ok(notificationView.includes('<Panel title="Recent notifications"><Table columns='));
  assert.ok(notificationView.includes("items.map(n=>["));
  assert.ok(notificationView.includes("onRead(n.id)"));
  assert.ok(!notificationView.includes('<LogMiniChart'),'Notification views should not include a chart');
  assert.ok(!dashboard.includes('title="Notification activity"'));
});
