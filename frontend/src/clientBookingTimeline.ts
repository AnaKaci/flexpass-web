import type {Booking} from './types';

/** A future reservation remains visible to the member even if the partner
 * marked it CHECKED_IN before its scheduled start. Only cancelled and past
 * reservations should be excluded from the next-experience panel.
 */
export function upcomingClientBookings(bookings:Booking[],now:Date):Booking[]{
  const timestamp=now.getTime();
  return bookings
    .filter(booking=>
      (booking.status==='BOOKED'||booking.status==='CHECKED_IN') &&
      new Date(booking.start_at).getTime()>=timestamp
    )
    .sort((a,b)=>new Date(a.start_at).getTime()-new Date(b.start_at).getTime()||a.id-b.id);
}

/** Check-in is not equivalent to an already-completed experience if its
 * scheduled time has not happened yet. This is a presentation-only count;
 * ledger and partner settlement rules are unchanged.
 */
export function completedClientVisits(bookings:Booking[],now:Date):number{
  const timestamp=now.getTime();
  return bookings.filter(booking=>
    booking.status==='CHECKED_IN' &&
    new Date(booking.start_at).getTime()<timestamp
  ).length;
}
