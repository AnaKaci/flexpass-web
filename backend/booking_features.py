"""Client booking holds, FIFO waitlists and cancellation corrections.

These features use NEW tables. Existing Bookings and Ledgers remain untouched.
Every seat-changing transaction serializes on Slot (BEGIN IMMEDIATE in SQLite;
SELECT FOR UPDATE on PostgreSQL). Expired holds don't consume availability.
"""
from datetime import timedelta
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, select, func
from .app import Base, now, iso


HOLD_MINUTES = 5
OFFER_MINUTES = 10


class SlotHold(Base):
    __tablename__ = 'slot_holds'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    slot_id = Column(Integer, ForeignKey('slots.id'), nullable=False, index=True)
    waitlist_id = Column(Integer, ForeignKey('waitlist_entries.id'))
    created_at = Column(DateTime, nullable=False, default=now)
    expires_at = Column(DateTime, nullable=False, index=True)
    __table_args__ = (UniqueConstraint('user_id', 'slot_id', name='uq_slot_hold_user_slot'),)


class WaitlistEntry(Base):
    __tablename__ = 'waitlist_entries'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    slot_id = Column(Integer, ForeignKey('slots.id'), nullable=False, index=True)
    status = Column(String(20), nullable=False, default='WAITING')
    created_at = Column(DateTime, nullable=False, default=now)
    offered_at = Column(DateTime)
    offer_expires_at = Column(DateTime)
    __table_args__ = (UniqueConstraint('user_id', 'slot_id', name='uq_waitlist_user_slot'),)


class BookingCancellation(Base):
    __tablename__ = 'booking_cancellations'
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey('bookings.id'), nullable=False, unique=True)
    refunded_credits = Column(Integer, nullable=False)
    retained_credits = Column(Integer, nullable=False)
    policy_tier = Column(String(30), nullable=False)
    reason = Column(String(500), default='')
    actor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, nullable=False, default=now)


class AdminRefundBody(BaseModel):
    refund_credits: int = Field(ge=0, le=100000)
    reason: str = Field(min_length=8, max_length=500)


def core():
    from . import app as application
    return application


def active_holds(db, slot_id, at=None):
    return int(db.scalar(select(func.count(SlotHold.id)).where(
        SlotHold.slot_id == slot_id, SlotHold.expires_at > (at or now()))) or 0)


def hold_view(hold):
    return {'id': hold.id, 'slot_id': hold.slot_id, 'expires_at': iso(hold.expires_at),
            'offered_from_waitlist': hold.waitlist_id is not None}


def waitlist_view(db, entry):
    held = db.scalar(select(SlotHold).where(SlotHold.waitlist_id == entry.id,
                      SlotHold.expires_at > now())) if entry.status == 'OFFERED' else None
    slot = db.get(core().Slot, entry.slot_id)
    return {'id': entry.id, 'slot_id': entry.slot_id,
            'start_at': iso(slot.start_at) if slot else None, 'status': entry.status,
            'joined_at': iso(entry.created_at), 'offer_expires_at': iso(entry.offer_expires_at),
            'hold_id': held.id if held else None}


def reconcile_waitlist(db, slot):
    """Run with the Slot row locked; advance expired holds and offer FIFO places.

    On a free seat, an in-app notification is written atomically with a ten-minute
    hold. Expiry-only promotions are also triggered by client waitlist reads.
    """
    c = core()
    clock = now()
    expired = db.scalars(select(SlotHold).where(
        SlotHold.slot_id == slot.id, SlotHold.expires_at <= clock).with_for_update()).all()
    for hold in expired:
        if hold.waitlist_id:
            entry = db.get(WaitlistEntry, hold.waitlist_id)
            if entry and entry.status == 'OFFERED':
                entry.status = 'EXPIRED'
                c.notify_user(db, entry.user_id, 'WAITLIST_EXPIRED',
                              'Waitlist offer expired', 'Your held place expired; you can join again.')
        db.delete(hold)
    db.flush()
    if slot.start_at <= clock:
        return
    service = db.get(c.Service, slot.service_id)
    if not service or not service.active:
        return
    seats = max(0, slot.capacity - slot.reserved - active_holds(db, slot.id, clock))
    if seats == 0:
        return
    queue = db.scalars(select(WaitlistEntry).where(
        WaitlistEntry.slot_id == slot.id, WaitlistEntry.status == 'WAITING'
    ).order_by(WaitlistEntry.created_at, WaitlistEntry.id).with_for_update()).all()
    for entry in queue:
        if seats == 0:
            break
        member = db.get(c.User, entry.user_id)  # Slot lock already serializes the offer
        if not member or member.membership_status != 'ACTIVE' or c.balance(db, entry.user_id) < service.credits:
            entry.status = 'EXPIRED'
            c.notify_user(db, entry.user_id, 'WAITLIST_UNAVAILABLE',
                          'Waitlist entry closed',
                          'A place could not be reserved. Please check your account and credits.')
            continue
        if db.scalar(select(SlotHold.id).where(SlotHold.slot_id == slot.id,
                                              SlotHold.user_id == entry.user_id)):
            continue
        expiry = min(clock + timedelta(minutes=OFFER_MINUTES), slot.start_at)
        db.add(SlotHold(user_id=entry.user_id, slot_id=slot.id,
                        waitlist_id=entry.id, expires_at=expiry))
        entry.status = 'OFFERED'
        entry.offered_at = clock
        entry.offer_expires_at = expiry
        c.notify_user(db, entry.user_id, 'WAITLIST_OFFER', 'A spot is available',
                      'Your place is reserved for up to ten minutes. Confirm your booking in Explore.')
        seats -= 1
    db.flush()


def cancellation_quote(booking, slot):
    c = core()
    seconds = (slot.start_at - now()).total_seconds()
    if seconds <= 0 or seconds <= c.CANCELLATION_CUTOFF_HOURS * 3600:
        return {'allowed': False, 'refund_credits': 0,
                'retained_credits': booking.credits_snapshot, 'policy_tier': 'CLOSED'}
    if seconds >= c.CANCELLATION_FULL_HOURS * 3600:
        percent, tier = 100, 'FULL'
    elif seconds >= c.CANCELLATION_PARTIAL_HOURS * 3600:
        percent, tier = c.CANCELLATION_PARTIAL_PERCENT, 'PARTIAL'
    else:
        percent, tier = 0, 'LATE'
    refund = (booking.credits_snapshot * percent + 50) // 100
    return {'allowed': True, 'refund_credits': refund,
            'retained_credits': booking.credits_snapshot - refund, 'policy_tier': tier}


def install_routes():
    c = core()

    @c.app.get('/api/booking-policy')
    def booking_policy(u=Depends(c.roles('employee', 'client'))):
        return {'full_refund_before_hours': c.CANCELLATION_FULL_HOURS,
                'partial_refund_before_hours': c.CANCELLATION_PARTIAL_HOURS,
                'partial_refund_percent': c.CANCELLATION_PARTIAL_PERCENT,
                'minimum_notice_hours': c.CANCELLATION_CUTOFF_HOURS,
                'hold_minutes': HOLD_MINUTES, 'waitlist_offer_minutes': OFFER_MINUTES}

    @c.app.post('/api/slots/{slot_id}/hold')
    def reserve_hold(slot_id: int, u=Depends(c.roles('employee', 'client'))):
        with c.Session() as db:
            try:
                c.lock_transaction(db)
                member = db.scalar(select(c.User).where(c.User.id == u.id).with_for_update())
                if not member or member.membership_status != 'ACTIVE':
                    raise HTTPException(403, 'Account inactive')
                slot = db.scalar(select(c.Slot).where(c.Slot.id == slot_id).with_for_update())
                if not slot:
                    raise HTTPException(404, 'Session not found')
                if slot.start_at <= now():
                    raise HTTPException(409, 'Session already started')
                service = db.get(c.Service, slot.service_id)
                if not service or not service.active:
                    raise HTTPException(409, 'Service unavailable')
                if c.balance(db, u.id) < service.credits:
                    raise HTTPException(409, 'Insufficient credits')
                reconcile_waitlist(db, slot)
                existing = db.scalar(select(SlotHold).where(SlotHold.user_id == u.id,
                                                            SlotHold.slot_id == slot.id))
                if existing and existing.expires_at > now():
                    answer = hold_view(existing)
                    db.commit()
                    return answer  # an existing hold is never extended
                if db.scalar(select(c.Booking.id).where(c.Booking.user_id == u.id,
                                                        c.Booking.slot_id == slot.id)):
                    raise HTTPException(409, 'Already booked this session')
                if slot.reserved + active_holds(db, slot.id) >= slot.capacity:
                    raise HTTPException(409, 'Session full. Join the waitlist.')
                new = SlotHold(user_id=u.id, slot_id=slot.id,
                               expires_at=min(now()+timedelta(minutes=HOLD_MINUTES), slot.start_at))
                db.add(new)
                db.flush()
                answer = hold_view(new)
                c.audit(db, u.id, 'SLOT_HELD', f'{slot.id}:{new.id}')
                db.commit()
                return answer
            except HTTPException:
                db.rollback()
                raise

    @c.app.delete('/api/client/holds/{hold_id}')
    def release_hold(hold_id: int, u=Depends(c.roles('employee', 'client'))):
        with c.Session() as db:
            c.lock_transaction(db)
            held = db.scalar(select(SlotHold).where(SlotHold.id == hold_id,
                                                     SlotHold.user_id == u.id))
            if not held:
                return {'released': False}
            slot = db.scalar(select(c.Slot).where(c.Slot.id == held.slot_id).with_for_update())
            if not slot:
                raise HTTPException(404, 'Session not found')
            held = db.get(SlotHold, hold_id)
            offer = db.get(WaitlistEntry, held.waitlist_id) if held.waitlist_id else None
            if offer and offer.status == 'OFFERED':
                offer.status = 'EXPIRED'
            db.delete(held)
            db.flush()
            reconcile_waitlist(db, slot)
            db.commit()
            return {'released': True}

    @c.app.post('/api/slots/{slot_id}/waitlist')
    def join_waitlist(slot_id: int, u=Depends(c.roles('employee', 'client'))):
        with c.Session() as db:
            try:
                c.lock_transaction(db)
                member = db.scalar(select(c.User).where(c.User.id == u.id).with_for_update())
                if not member or member.membership_status != 'ACTIVE':
                    raise HTTPException(403, 'Account inactive')
                slot = db.scalar(select(c.Slot).where(c.Slot.id == slot_id).with_for_update())
                if not slot:
                    raise HTTPException(404, 'Session not found')
                if slot.start_at <= now():
                    raise HTTPException(409, 'Session already started')
                service = db.get(c.Service, slot.service_id)
                if not service or not service.active:
                    raise HTTPException(409, 'Service unavailable')
                if c.balance(db, u.id) < service.credits:
                    raise HTTPException(409, 'Insufficient credits')
                reconcile_waitlist(db, slot)
                if db.scalar(select(c.Booking.id).where(c.Booking.user_id == u.id,
                                                        c.Booking.slot_id == slot.id)):
                    raise HTTPException(409, 'Already booked this session')
                old = db.scalar(select(WaitlistEntry).where(
                    WaitlistEntry.user_id == u.id, WaitlistEntry.slot_id == slot.id).with_for_update())
                if old and old.status in ('WAITING', 'OFFERED'):
                    response = waitlist_view(db, old)
                    db.commit()
                    return response
                if slot.reserved + active_holds(db, slot.id) < slot.capacity:
                    raise HTTPException(409, 'A place is available. Reserve directly.')
                if old:
                    old.status = 'WAITING'
                    old.created_at = now()
                    old.offered_at = None
                    old.offer_expires_at = None
                    entry = old
                else:
                    entry = WaitlistEntry(user_id=u.id, slot_id=slot.id, status='WAITING')
                    db.add(entry)
                    db.flush()
                c.audit(db, u.id, 'WAITLIST_JOINED', f'{slot.id}:{entry.id}')
                response = waitlist_view(db, entry)
                db.commit()
                return response
            except HTTPException:
                db.rollback()
                raise

    @c.app.get('/api/client/waitlist')
    def get_waitlist(u=Depends(c.roles('employee', 'client'))):
        with c.Session() as db:
            c.lock_transaction(db)
            entries = db.scalars(select(WaitlistEntry).where(
                WaitlistEntry.user_id == u.id).order_by(WaitlistEntry.id.desc()).limit(100)).all()
            for slot_id in sorted({x.slot_id for x in entries if x.status in ('WAITING', 'OFFERED')}):
                slot = db.scalar(select(c.Slot).where(c.Slot.id == slot_id).with_for_update())
                if slot:
                    reconcile_waitlist(db, slot)
            answer = [waitlist_view(db, x) for x in entries if x.status in ('WAITING', 'OFFERED')]
            db.commit()
            return answer

    @c.app.delete('/api/client/waitlist/{entry_id}')
    def leave_waitlist(entry_id: int, u=Depends(c.roles('employee', 'client'))):
        with c.Session() as db:
            c.lock_transaction(db)
            entry = db.scalar(select(WaitlistEntry).where(
                WaitlistEntry.id == entry_id, WaitlistEntry.user_id == u.id))
            if not entry:
                raise HTTPException(404, 'Waitlist entry not found')
            slot = db.scalar(select(c.Slot).where(c.Slot.id == entry.slot_id).with_for_update())
            if entry.status not in ('WAITING', 'OFFERED'):
                raise HTTPException(409, 'Waitlist entry already closed')
            held = db.scalar(select(SlotHold).where(SlotHold.waitlist_id == entry.id))
            if held:
                db.delete(held)
                db.flush()
            entry.status = 'CANCELLED'
            if slot:
                reconcile_waitlist(db, slot)
            c.audit(db, u.id, 'WAITLIST_LEFT', str(entry.id))
            db.commit()
            return {'status': 'CANCELLED'}

    @c.app.get('/api/bookings/{booking_id}/cancellation-quote')
    def get_quote(booking_id: int, u=Depends(c.roles('employee', 'client'))):
        with c.Session() as db:
            booking = db.get(c.Booking, booking_id)
            if not booking or booking.user_id != u.id:
                raise HTTPException(404, 'Booking not found')
            if booking.status != 'BOOKED':
                raise HTTPException(409, 'Only active bookings can be cancelled')
            return {'booking_id': booking.id, **cancellation_quote(booking, db.get(c.Slot, booking.slot_id))}

    @c.app.post('/api/admin/bookings/{booking_id}/refund')
    def correct_refund(booking_id: int, body: AdminRefundBody,
                       u=Depends(c.roles('admin'))):
        with c.Session() as db:
            try:
                c.lock_transaction(db)
                booking = db.scalar(select(c.Booking).where(c.Booking.id == booking_id).with_for_update())
                if not booking:
                    raise HTTPException(404, 'Booking not found')
                if booking.status not in ('BOOKED', 'CANCELLED'):
                    raise HTTPException(409, 'Cannot refund a completed visit')
                if body.refund_credits > booking.credits_snapshot:
                    raise HTTPException(422, 'Refund exceeds booking credit charge')
                already = int(db.scalar(select(func.coalesce(func.sum(c.Ledger.amount), 0)).where(
                    c.Ledger.booking_id == booking.id, c.Ledger.kind == 'REFUND')) or 0)
                if body.refund_credits < already:
                    raise HTTPException(409, 'Cannot withdraw previously refunded credits')
                slot = db.scalar(select(c.Slot).where(c.Slot.id == booking.slot_id).with_for_update())
                if booking.status == 'BOOKED':
                    if slot.reserved < 1:
                        raise HTTPException(409, 'Slot inventory is inconsistent')
                    booking.status = 'CANCELLED'
                    booking.cancelled_at = now()
                    slot.reserved -= 1
                extra = body.refund_credits - already
                if extra:
                    db.add(c.Ledger(user_id=booking.user_id, booking_id=booking.id,
                                    kind='REFUND', source='PERSONAL',
                                    amount=extra, period=now().strftime('%Y-%m'),
                                    actor_id=u.id, reason='Admin correction: ' + body.reason))
                record = db.scalar(select(BookingCancellation).where(
                    BookingCancellation.booking_id == booking.id))
                if record:
                    record.refunded_credits = body.refund_credits
                    record.retained_credits = booking.credits_snapshot - body.refund_credits
                    record.policy_tier = 'ADMIN_OVERRIDE'
                    record.reason = body.reason
                    record.actor_id = u.id
                else:
                    db.add(BookingCancellation(
                        booking_id=booking.id, refunded_credits=body.refund_credits,
                        retained_credits=booking.credits_snapshot - body.refund_credits,
                        policy_tier='ADMIN_OVERRIDE', reason=body.reason, actor_id=u.id))
                if slot:
                    reconcile_waitlist(db, slot)
                c.audit(db, u.id, 'BOOKING_REFUND_CORRECTED',
                        f'{booking.reference}: total={body.refund_credits}, extra={extra}, reason={body.reason}')
                if extra:
                    c.notify_user(db, booking.user_id, 'BOOKING_REFUND_CORRECTED',
                                  'Refund adjusted', f'{extra} additional credits have been returned.')
                db.commit()
                return {'status': 'CANCELLED', 'refunded': body.refund_credits,
                        'additional_refund': extra,
                        'retained': booking.credits_snapshot - body.refund_credits}
            except HTTPException:
                db.rollback()
                raise
