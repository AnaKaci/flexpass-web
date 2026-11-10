"""Operational feature contracts: tenant isolation, credit invariants and replay safety."""
import uuid
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app import app,Session,Partner,Service,Slot,User,Ledger,hash_pass,now,Booking,ServiceReview,Notification

api=TestClient(app)
PASSWORD='OperationalTestingPassword2026!'

def setup_accounts():
    ident=uuid.uuid4().hex[:12]
    with Session() as db:
        partner=Partner(name='Feature Partner '+ident,zone='Blloku')
        other=Partner(name='Feature Other '+ident,zone='Blloku')
        db.add_all([partner,other]);db.flush()
        service=Service(partner_id=partner.id,name='Feature Pilates '+ident,group_name='fitness',
                        subcategory='Pilates',credits=2,payout_cents=10000,duration_minutes=60,active=True)
        db.add(service);db.flush()
        start=now()+timedelta(minutes=30)
        slot=Slot(service_id=service.id,start_at=start,capacity=1,reserved=0)
        db.add(slot);db.flush()
        client=User(email='feature.client.'+ident+'@example.test',full_name='Feature Client',
                    password_hash=hash_pass(PASSWORD),role='client',membership_status='ACTIVE')
        staff=User(email='feature.staff.'+ident+'@example.test',full_name='Feature Partner Staff',
                   password_hash=hash_pass(PASSWORD),role='partner',partner_id=partner.id,membership_status='ACTIVE')
        stranger=User(email='feature.other.'+ident+'@example.test',full_name='Other Staff',
                      password_hash=hash_pass(PASSWORD),role='partner',partner_id=other.id,membership_status='ACTIVE')
        admin=User(email='feature.admin.'+ident+'@example.test',full_name='Feature Admin',
                   password_hash=hash_pass(PASSWORD),role='admin',membership_status='ACTIVE')
        db.add_all([client,staff,stranger,admin]);db.flush()
        db.add(Ledger(user_id=client.id,kind='ALLOCATION',amount=20,
                      period=now().strftime('%Y-%m'),reason='Feature integration test credits'))
        ids={'slot':slot.id,'service':service.id,'partner':partner.id,'client':client.id,'staff':staff.id}
        db.commit()
    def token(email,portal):
        endpoint='/api/auth/admin/login' if portal=='admin' else '/api/auth/login'
        response=api.post(endpoint,json={'email':email,'password':PASSWORD,'portal':portal})
        assert response.status_code==200,response.text
        return {'Authorization':'Bearer '+response.json()['token']}
    return ids,token(client.email,'client'),token(staff.email,'partner'),token(stranger.email,'partner'),token(admin.email,'admin')

def test_booking_code_notifications_reviews_are_scoped_and_one_time():
    ids,client,staff,other,admin=setup_accounts()
    created=api.post('/api/bookings',headers=client,json={'slot_id':ids['slot']})
    assert created.status_code==200,created.text
    booking_id=created.json()['id']
    assert api.get('/api/notifications',headers=client).status_code==200
    client_items=api.get('/api/notifications',headers=client).json()
    partner_items=api.get('/api/notifications',headers=staff).json()
    assert any(x['kind']=='BOOKING_CREATED' for x in client_items)
    assert any(x['kind']=='NEW_BOOKING' for x in partner_items)
    notice_id=client_items[0]['id']
    assert api.post(f'/api/notifications/{notice_id}/read',headers=staff,json={}).status_code==404
    assert api.post(f'/api/notifications/{notice_id}/read',headers=client,json={}).status_code==200
    assert api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':5,'comment':'Very good activity'}).status_code==409
    issued=api.post(f'/api/client/bookings/{booking_id}/checkin-code',headers=client,json={})
    assert issued.status_code==200,issued.text
    code=issued.json()['code']
    assert len(code)==8 and code.isdigit()
    assert api.post(f'/api/partner/bookings/{booking_id}/verify-checkin',headers=other,json={'code':code}).status_code==403
    assert api.post(f'/api/partner/bookings/{booking_id}/verify-checkin',headers=staff,json={'code':'00000000' if code!='00000000' else '11111111'}).status_code==403
    verified=api.post(f'/api/partner/bookings/{booking_id}/verify-checkin',headers=staff,json={'code':code})
    assert verified.status_code==200,verified.text
    assert api.post(f'/api/partner/bookings/{booking_id}/verify-checkin',headers=staff,json={'code':code}).status_code==409
    assert api.post(f'/api/client/bookings/{booking_id}/checkin-code',headers=client,json={}).status_code==409
    review=api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':5,'comment':'A great experience'})
    assert review.status_code==200,review.text
    assert api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':5,'comment':'Duplicate content'}).status_code==409
    reviews=api.get(f'/api/services/{ids["service"]}/reviews',headers=client)
    assert reviews.status_code==200 and reviews.json()['count']==1
    assert 'email' not in str(reviews.json())
    assert api.get('/api/admin/analytics',headers=client).status_code==403
    analytics=api.get('/api/admin/analytics',headers=admin)
    assert analytics.status_code==200,analytics.text
    assert any(x['name']=='fitness' for x in analytics.json()['categories'])

def test_bulk_slots_are_owned_bounded_and_idempotent_on_replay():
    ids,client,staff,other,admin=setup_accounts()
    start=(now()+timedelta(days=5)).isoformat()+'Z'
    payload={'service_id':ids['service'],'start_at':start,'capacity':8,'count':4,'frequency':'weekly'}
    assert api.post('/api/partner/slots/bulk',headers=other,json=payload).status_code==403
    first=api.post('/api/partner/slots/bulk',headers=staff,json=payload)
    assert first.status_code==200,first.text
    assert first.json()=={'created':4,'skipped':0}
    repeated=api.post('/api/partner/slots/bulk',headers=staff,json=payload)
    assert repeated.status_code==200,repeated.text
    assert repeated.json()=={'created':0,'skipped':4}
    assert api.post('/api/partner/slots/bulk',headers=staff,json={**payload,'count':500}).status_code==422
    entries=api.get('/api/partner/services',headers=staff)
    assert entries.status_code==200
    matches=[sv for sv in entries.json() if sv['id']==ids['service']]
    assert len(matches)==1 and len(matches[0]['slots'])==5
