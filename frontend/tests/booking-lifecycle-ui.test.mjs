import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const service=readFileSync(new URL('../src/ServicesPage.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const admin=readFileSync(new URL('../src/AdminBookingAdjustments.tsx',import.meta.url),'utf8');
const waits=readFileSync(new URL('../src/ClientWaitlists.tsx',import.meta.url),'utf8');

test('Client booking dialog supports temporary holds and waitlists',()=>{
  assert.ok(service.includes("'/slots/'+slot+'/hold'"));
  assert.ok(service.includes("'/slots/'+slot+'/waitlist'"));
  assert.ok(service.includes('hold_id:activeHold.id'));
  assert.ok(service.includes('Join waitlist'));
  assert.ok(service.includes('Hold place for '));
  assert.ok(service.includes('Leave waitlist'));
  assert.ok(service.includes('offered_from_waitlist'));
});
test('cancellation confirms the exact server refund quote',()=>{
  assert.ok(dashboard.includes("'/bookings/'+b.id+'/cancellation-quote'"));
  assert.ok(dashboard.includes('quote.refund_credits'));
  assert.ok(dashboard.includes('quote.retained_credits'));
});
test('Client waitlists and Admin corrections use separate routes',()=>{
  assert.ok(dashboard.includes('<AdminBookingAdjustments/>'));
  assert.ok(dashboard.includes('<ClientWaitlists/>'));
  assert.ok(admin.includes("'/admin/bookings/'+booking.id+'/refund'"));
  assert.ok(admin.includes('refund_credits'));
  assert.ok(waits.includes("'/client/waitlist/'+id"));
  assert.ok(waits.includes("'/client/discover?q='"));
});
