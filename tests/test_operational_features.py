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

def test_optional_review_comment_and_business_feedback_are_tenant_scoped():
    ids,client,staff,other,admin=setup_accounts()
    booking=api.post('/api/bookings',headers=client,json={'slot_id':ids['slot']})
    assert booking.status_code==200,booking.text
    booking_id=booking.json()['id']
    assert api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':4}).status_code==409
    assert api.post(f'/api/partner/bookings/{booking_id}/checkin',headers=staff,json={}).status_code==200

    assert api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':0}).status_code==422
    review=api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':4})
    assert review.status_code==200,review.text
    assert review.json()['comment']==''
    assert api.post(f'/api/client/bookings/{booking_id}/review',headers=client,json={'rating':5}).status_code==409

    owned=api.get('/api/partner/reviews',headers=staff)
    assert owned.status_code==200,owned.text
    report=owned.json()
    matching=[item for item in report['reviews'] if item['service_id']==ids['service']]
    assert len(matching)==1 and matching[0]['rating']==4 and matching[0]['comment']==''
    summary=[item for item in report['services'] if item['id']==ids['service']]
    assert len(summary)==1 and summary[0]['count']==1 and summary[0]['average_rating']==4
    assert report['average_rating']==4

    outsider=api.get('/api/partner/reviews',headers=other)
    assert outsider.status_code==200,outsider.text
    assert all(item['service_id']!=ids['service'] for item in outsider.json()['reviews'])
    assert all(item['id']!=ids['service'] for item in outsider.json()['services'])
    assert api.get('/api/partner/reviews',headers=client).status_code==403
    assert api.get('/api/partner/reviews/export',headers=client).status_code==403
    assert api.get('/api/partner/reviews',headers=admin).status_code==403

    exported=api.get('/api/partner/reviews/export',headers=staff)
    assert exported.status_code==200 and 'text/csv' in exported.headers['content-type']
    assert 'Feature Pilates' in exported.text
    assert 'Feature Client' not in exported.text
    assert 'feature.client.' not in exported.text
    other_csv=api.get('/api/partner/reviews/export',headers=other)
    assert other_csv.status_code==200
    assert 'Feature Pilates' not in other_csv.text


def test_partner_feedback_csv_sanitizes_formula_like_comments():
    ids,client,staff,other,_admin=setup_accounts()
    response=api.post('/api/bookings',headers=client,json={'slot_id':ids['slot']})
    assert response.status_code==200,response.text
    booking_id=response.json()['id']
    assert api.post(f'/api/partner/bookings/{booking_id}/checkin',headers=staff,json={}).status_code==200
    review=api.post(f'/api/client/bookings/{booking_id}/review',headers=client,
                    json={'rating':5,'comment':'=SUM(1,2)'})
    assert review.status_code==200,review.text
    csv_response=api.get('/api/partner/reviews/export',headers=staff)
    assert csv_response.status_code==200
    assert "'=SUM(1,2)" in csv_response.text
    # The normal API preserves the original feedback without spreadsheet escaping.
    rows=api.get('/api/partner/reviews',headers=staff).json()['reviews']
    assert any(row['comment']=='=SUM(1,2)' for row in rows)
