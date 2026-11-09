"""Business calendar reads existing partner-scoped reservations and current statuses."""
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app import app, Session, Partner, Service, Slot, User, Ledger, hash_pass, now

client=TestClient(app)
PASSWORD='PartnerCalendarTestPassword123!'

def auth(email,role):
    r=client.post('/api/auth/login',json={'email':email,'password':PASSWORD,'portal':role})
    assert r.status_code==200,r.text
    return {'Authorization':'Bearer '+r.json()['token']}

def test_partner_calendar_reservations_refresh_after_booking_and_status_changes():
    with Session() as s:
        first=Partner(name='Calendar QA First Partner',zone='Blloku')
        second=Partner(name='Calendar QA Other Partner',zone='Arena')
        s.add_all([first,second]);s.flush()
        service1=Service(partner_id=first.id,name='Calendar QA Yoga',group_name='fitness',
                         subcategory='Yoga',credits=2,payout_cents=10000,duration_minutes=60,active=True)
        service2=Service(partner_id=second.id,name='Calendar QA Swimming',group_name='sport',
                         subcategory='Swimming',credits=2,payout_cents=10000,duration_minutes=60,active=True)
        s.add_all([service1,service2]);s.flush()
        starts=[now()+timedelta(days=i) for i in (13,14,15)]
        slots=[Slot(service_id=service1.id,start_at=starts[i],capacity=4,reserved=0) for i in (0,1)]
        slots.append(Slot(service_id=service2.id,start_at=starts[2],capacity=4,reserved=0))
        s.add_all(slots)
        u=User(email='calendar.qa.client@example.test',full_name='Calendar Test Client',
               role='client',membership_status='ACTIVE',password_hash=hash_pass(PASSWORD))
        p=User(email='calendar.qa.first@example.test',full_name='First Calendar Partner',
               role='partner',partner_id=first.id,membership_status='ACTIVE',password_hash=hash_pass(PASSWORD))
        other=User(email='calendar.qa.other@example.test',full_name='Other Calendar Partner',
                   role='partner',partner_id=second.id,membership_status='ACTIVE',password_hash=hash_pass(PASSWORD))
        s.add_all([u,p,other]);s.flush()
        s.add(Ledger(user_id=u.id,kind='ALLOCATION',amount=30,
                     period=now().strftime('%Y-%m'),reason='Calendar test only'))
        ids=[x.id for x in slots]
        s.commit()
    auth_client=auth(u.email,'client')
    partner=auth(p.email,'partner')
    other_partner=auth(other.email,'partner')
    before=client.get('/api/partner/bookings',headers=partner)
    assert before.status_code==200 and before.json()==[]
    assert client.get('/api/partner/bookings',headers=auth_client).status_code==403
    assert client.get('/api/partner/bookings').status_code==401
    bookings=[]
    for slot_id in ids:
        r=client.post('/api/bookings',headers=auth_client,json={'slot_id':slot_id})
        assert r.status_code==200,r.text
        bookings.append(r.json())
    partner_data=client.get('/api/partner/bookings',headers=partner).json()
    assert {x['id'] for x in partner_data}=={bookings[0]['id'],bookings[1]['id']}
    assert all(x['email']==u.email for x in partner_data)
    assert all(x['start_at'].endswith('Z') for x in partner_data)
    other_data=client.get('/api/partner/bookings',headers=other_partner).json()
    assert [x['id'] for x in other_data]==[bookings[2]['id']]
    cancel=client.post(f"/api/bookings/{bookings[0]['id']}/cancel",headers=auth_client,json={})
    assert cancel.status_code==200,cancel.text
    checked=client.post(f"/api/partner/bookings/{bookings[1]['id']}/checkin",headers=partner,json={})
    assert checked.status_code==200,checked.text
    # A calendar refresh sees current statuses from the database without a page reload.
    latest=client.get('/api/partner/bookings',headers=partner).json()
    assert {x['id']:x['status'] for x in latest}=={
        bookings[0]['id']:'CANCELLED',bookings[1]['id']:'CHECKED_IN'
    }
    assert all(x['partner_id']==bookings[0]['partner_id'] for x in latest)
    assert client.post(f"/api/partner/bookings/{bookings[2]['id']}/checkin",
                       headers=partner,json={}).status_code==403
