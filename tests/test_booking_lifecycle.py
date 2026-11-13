"""Booking holds, FIFO waitlists, refunds, tenant access and credit invariants."""
import uuid
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app import (app, Session, User, Partner, Service, Slot, Ledger,
                         Booking, hash_pass, now)
from backend.booking_features import SlotHold, WaitlistEntry, BookingCancellation

api=TestClient(app)
PASSWORD='BookingLifecycleTesting2026!'


def fixture():
    suffix=uuid.uuid4().hex[:14]
    with Session() as db:
        partner=Partner(name='Lifecycle Partner '+suffix,zone='Blloku')
        db.add(partner); db.flush()
        svc=Service(partner_id=partner.id,name='Lifecycle Yoga '+suffix,group_name='fitness',
                    subcategory='Yoga',credits=5,payout_cents=12300,duration_minutes=60,active=True)
        db.add(svc);db.flush()
        slots=[Slot(service_id=svc.id,start_at=now()+timedelta(hours=n),capacity=1,reserved=0)
               for n in (48,12,2)]
        db.add_all(slots); db.flush()
        users={}
        for role in ('first','second','third','admin','partner'):
            is_admin=role=='admin'
            is_partner=role=='partner'
            user=User(email='life.'+role+suffix+'@example.test',full_name='Lifecycle '+role,
                      role='admin' if is_admin else 'partner' if is_partner else 'client',
                      partner_id=partner.id if is_partner else None,
                      membership_status='ACTIVE',password_hash=hash_pass(PASSWORD))
            db.add(user); db.flush()
            users[role]=user
            if not is_admin and not is_partner:
                db.add(Ledger(user_id=user.id,kind='ALLOCATION',amount=30,
                              source='PERSONAL',period=now().strftime('%Y-%m'),reason='Lifecycle test'))
        ids={'slots':[x.id for x in slots],'client_ids':{k:v.id for k,v in users.items()}}
        db.commit()

    def header(role):
        user=users[role]
        endpoint='/api/auth/admin/login' if role=='admin' else '/api/auth/login'
        portal='admin' if role=='admin' else 'partner' if role=='partner' else 'client'
        response=api.post(endpoint,json={'email':user.email,'password':PASSWORD,'portal':portal})
        assert response.status_code==200,response.text
        return {'Authorization':'Bearer '+response.json()['token']}
    return ids,{name:header(name) for name in users}


def wallet(headers):
    response=api.get('/api/client/summary',headers=headers)
    assert response.status_code==200,response.text
    return response.json()['balance']


def test_hold_blocks_competitors_without_spending_and_releases():
    ids,auth=fixture()
    slot=ids['slots'][0]
    first=api.post(f'/api/slots/{slot}/hold',headers=auth['first'])
    assert first.status_code==200,first.text
    hold=first.json()
    assert hold['id']>0 and hold['slot_id']==slot and not hold['offered_from_waitlist']
    assert wallet(auth['first'])==30
    repeat=api.post(f'/api/slots/{slot}/hold',headers=auth['first'])
    assert repeat.status_code==200 and repeat.json()['id']==hold['id']
    assert repeat.json()['expires_at']==hold['expires_at']
    assert api.post(f'/api/slots/{slot}/hold',headers=auth['second']).status_code==409
    assert api.post('/api/bookings',headers=auth['second'],json={'slot_id':slot}).status_code==409
    released=api.delete(f"/api/client/holds/{hold['id']}",headers=auth['first'])
    assert released.status_code==200 and released.json()['released']
    assert api.delete(f"/api/client/holds/{hold['id']}",headers=auth['second']).json()=={'released':False}
    assert api.post(f'/api/slots/{slot}/hold',headers=auth['second']).status_code==200
    assert wallet(auth['second'])==30


def test_waitlist_promotion_guards_capacity_and_redeems_offer_once():
    ids,auth=fixture()
    slot=ids['slots'][0]
    booking=api.post('/api/bookings',headers=auth['first'],json={'slot_id':slot})
    assert booking.status_code==200,booking.text
    joined=api.post(f'/api/slots/{slot}/waitlist',headers=auth['second'])
    assert joined.status_code==200,joined.text
    assert joined.json()['status']=='WAITING'
    again=api.post(f'/api/slots/{slot}/waitlist',headers=auth['second'])
    assert again.status_code==200 and again.json()['id']==joined.json()['id']
    assert api.get('/api/client/waitlist',headers=auth['first']).json()==[]
    assert api.post(f'/api/slots/{slot}/waitlist',headers=auth['partner']).status_code==403
    assert api.delete(f"/api/client/waitlist/{joined.json()['id']}",headers=auth['first']).status_code==404

    cancelled=api.post(f"/api/bookings/{booking.json()['id']}/cancel",headers=auth['first'])
    assert cancelled.status_code==200 and cancelled.json()['policy_tier']=='FULL'
    current=api.get('/api/client/waitlist',headers=auth['second']).json()
    assert len(current)==1 and current[0]['status']=='OFFERED'
    hold_id=current[0]['hold_id']
    assert isinstance(hold_id,int)
    assert api.post('/api/bookings',headers=auth['third'],json={'slot_id':slot}).status_code==409
    confirmed=api.post('/api/bookings',headers=auth['second'],
                       json={'slot_id':slot,'hold_id':hold_id})
    assert confirmed.status_code==200,confirmed.text
    assert wallet(auth['second'])==25
    assert api.get('/api/client/waitlist',headers=auth['second']).json()==[]
    assert api.post('/api/bookings',headers=auth['second'],
                    json={'slot_id':slot,'hold_id':hold_id}).status_code==409
    with Session() as db:
        entry=db.get(WaitlistEntry,joined.json()['id'])
        assert entry.status=='BOOKED'
        assert not db.scalar(select(SlotHold.id).where(SlotHold.id==hold_id))
        assert db.get(Slot,slot).reserved==1


def test_expired_waitlist_offer_advances_fifo_and_rejoin_works():
    ids,auth=fixture()
    slot=ids['slots'][0]
    first=api.post('/api/bookings',headers=auth['first'],json={'slot_id':slot})
    second=api.post(f'/api/slots/{slot}/waitlist',headers=auth['second'])
    third=api.post(f'/api/slots/{slot}/waitlist',headers=auth['third'])
    assert first.status_code==second.status_code==third.status_code==200
    assert api.post(f"/api/bookings/{first.json()['id']}/cancel",headers=auth['first']).status_code==200
    with Session() as db:
        expired=db.scalar(select(SlotHold).where(SlotHold.user_id==ids['client_ids']['second'],
                                                  SlotHold.slot_id==slot))
        assert expired is not None
        expired.expires_at=now()-timedelta(minutes=1)
        db.commit()
    second_entries=api.get('/api/client/waitlist',headers=auth['second'])
    assert second_entries.status_code==200 and second_entries.json()==[]
    third_entry=api.get('/api/client/waitlist',headers=auth['third']).json()[0]
    assert third_entry['status']=='OFFERED' and third_entry['hold_id'] is not None
    assert api.post('/api/bookings',headers=auth['second'],
                    json={'slot_id':slot}).status_code==409
    # The lapsed client may rejoin the back of the FIFO line.
    again=api.post(f'/api/slots/{slot}/waitlist',headers=auth['second'])
    assert again.status_code==200 and again.json()['status']=='WAITING'
    assert api.delete(f"/api/client/waitlist/{third_entry['id']}",
                      headers=auth['third']).status_code==200
    now_offered=api.get('/api/client/waitlist',headers=auth['second']).json()
    assert len(now_offered)==1 and now_offered[0]['status']=='OFFERED'


def test_tiered_refunds_and_admin_corrections_are_credit_safe():
    ids,auth=fixture()
    policy=api.get('/api/booking-policy',headers=auth['first'])
    assert policy.status_code==200
    assert policy.json()['full_refund_before_hours']==24
    assert policy.json()['partial_refund_before_hours']==6
    assert policy.json()['partial_refund_percent']==50
    expected=[('FULL',5),('PARTIAL',3),('LATE',0)]
    for slot_id,(tier,refund) in zip(ids['slots'],expected):
        created=api.post('/api/bookings',headers=auth['first'],json={'slot_id':slot_id})
        assert created.status_code==200,created.text
        bid=created.json()['id']
        quote=api.get(f'/api/bookings/{bid}/cancellation-quote',headers=auth['first'])
        assert quote.status_code==200 and quote.json()['refund_credits']==refund
        assert api.get(f'/api/bookings/{bid}/cancellation-quote',
                       headers=auth['second']).status_code==404
        result=api.post(f'/api/bookings/{bid}/cancel',headers=auth['first'])
        assert result.status_code==200 and result.json()['policy_tier']==tier
        assert result.json()['refunded']==refund
        assert result.json()['retained']==5-refund
        assert api.post(f'/api/bookings/{bid}/cancel',headers=auth['first']).status_code==409
        if tier=='PARTIAL':
            middle_id=bid
    assert wallet(auth['first'])==23  # 30 - 15 spent + 8 refunded
    assert api.post(f'/api/admin/bookings/{middle_id}/refund',headers=auth['second'],
                    json={'refund_credits':5,'reason':'Service cancellation'}).status_code==403
    adjust=api.post(f'/api/admin/bookings/{middle_id}/refund',headers=auth['admin'],
                    json={'refund_credits':5,'reason':'Service cancellation'})
    assert adjust.status_code==200,adjust.text
    assert adjust.json()['additional_refund']==2
    repeated=api.post(f'/api/admin/bookings/{middle_id}/refund',headers=auth['admin'],
                      json={'refund_credits':5,'reason':'Service cancellation'})
    assert repeated.status_code==200 and repeated.json()['additional_refund']==0
    assert api.post(f'/api/admin/bookings/{middle_id}/refund',headers=auth['admin'],
                    json={'refund_credits':2,'reason':'Unauthorized clawback'}).status_code==409
    assert api.post(f'/api/admin/bookings/{middle_id}/refund',headers=auth['admin'],
                    json={'refund_credits':6,'reason':'Exceeds original'}).status_code==422
    assert wallet(auth['first'])==25
    with Session() as db:
        rows=db.scalars(select(Ledger).where(Ledger.booking_id==middle_id,Ledger.kind=='REFUND')).all()
        assert sum(x.amount for x in rows)==5
        record=db.scalar(select(BookingCancellation).where(
            BookingCancellation.booking_id==middle_id))
        assert record.policy_tier=='ADMIN_OVERRIDE'
        assert record.refunded_credits==5
