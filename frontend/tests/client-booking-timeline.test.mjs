import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../src/clientBookingTimeline.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {upcomingClientBookings,completedClientVisits}=
  await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

const now=new Date('2026-11-09T17:00:00Z');
function booking(id,status,start_at){
  return {id,status,start_at};
}

test('future checked-in and booked reservations appear in chronological order',()=>{
  const rows=[
    booking(3,'BOOKED','2026-11-20T12:00:00Z'),
    booking(2,'CHECKED_IN','2026-11-19T10:00:00Z'),
    booking(1,'CHECKED_IN','2026-11-12T11:00:00Z')
  ];
  assert.deepEqual(upcomingClientBookings(rows,now).map(x=>x.id),[1,2,3]);
});

test('cancelled and past reservations are absent from next-experience panel',()=>{
  const rows=[
    booking(1,'CANCELLED','2026-11-19T10:00:00Z'),
    booking(2,'BOOKED','2026-11-08T10:00:00Z'),
    booking(3,'CHECKED_IN','2026-11-08T10:00:00Z'),
    booking(4,'BOOKED','2026-11-13T10:00:00Z')
  ];
  assert.deepEqual(upcomingClientBookings(rows,now).map(x=>x.id),[4]);
});

test('completed visit count excludes future early check-ins',()=>{
  const rows=[
    booking(1,'CHECKED_IN','2026-11-12T11:00:00Z'),
    booking(2,'CHECKED_IN','2026-11-19T10:00:00Z'),
    booking(3,'CHECKED_IN','2026-11-08T10:00:00Z'),
    booking(4,'CANCELLED','2026-11-08T10:00:00Z'),
    booking(5,'BOOKED','2026-11-08T10:00:00Z')
  ];
  assert.equal(completedClientVisits(rows,now),1);
});
