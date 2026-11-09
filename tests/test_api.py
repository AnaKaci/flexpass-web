"""Acceptance smoke tests; run `pytest -q` from project root."""
import os
import tempfile
from pathlib import Path

os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(tempfile.mkdtemp()) / 'test_flexpass.db')
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def auth(role):
    r=client.post('/api/auth/admin/login' if role=='admin' else '/api/auth/login',json={'email':f'{role}@flexpass.demo','password':'Demo123!','portal':role})
    assert r.status_code==200,r.text
    return {'Authorization':'Bearer '+r.json()['token']}

def test_catalog_filters_and_authorization():
    rows=client.get('/api/catalog?group=fitness&maxCredits=5',headers=auth('employee')).json()
    assert rows and all(x['credits']<=5 and x['group']=='fitness' for x in rows)
    assert client.get('/api/admin/companies',headers=auth('employee')).status_code==403
    assert client.get('/api/employee/summary',headers=auth('partner')).status_code==403
    assert client.get('/api/employee/summary').status_code==401
    assert client.get('/api/catalog').status_code==401
    assert client.post('/api/auth/admin/login',json={'email':'employee@flexpass.demo','password':'Demo123!','portal':'admin'}).status_code==401
    assert client.post('/api/auth/login',json={'email':'admin@flexpass.demo','password':'Demo123!','portal':'employee'}).status_code==401

def test_booking_ledger_and_idempotent_cancel():
    emp=auth('employee')
    initial=client.get('/api/employee/summary',headers=emp).json()['balance']
    assert initial==30
    rows=client.get('/api/catalog?group=fitness&maxCredits=5',headers=emp).json()
    sv=rows[0]
    b=client.post('/api/bookings',json={'slot_id':sv['slots'][0]['id']},headers=emp)
    assert b.status_code==200,b.text
    booking=b.json()
    assert client.get('/api/employee/summary',headers=emp).json()['balance']==initial-sv['credits']
    assert client.post('/api/bookings',json={'slot_id':sv['slots'][0]['id']},headers=emp).status_code==409
    assert client.post(f"/api/bookings/{booking['id']}/cancel",json={},headers=emp).status_code==200
    assert client.post(f"/api/bookings/{booking['id']}/cancel",json={},headers=emp).status_code==409
    assert client.get('/api/employee/summary',headers=emp).json()['balance']==initial
    ledger=client.get('/api/employee/ledger',headers=emp).json()
    assert sum(x['amount'] for x in ledger)==initial
    assert len([x for x in ledger if x['kind']=='REFUND'])==1

def test_partner_checkin_and_settlement_once():
    emp=auth('employee');partner=auth('partner');admin=auth('admin')
    sv=next(s for s in client.get('/api/catalog?group=fitness',headers=emp).json() if s['partner_id']==1)
    r=client.post('/api/bookings',json={'slot_id':sv['slots'][1]['id']},headers=emp)
    assert r.status_code==200,r.text
    b=r.json()
    assert any(x['id']==b['id'] for x in client.get('/api/partner/bookings',headers=partner).json())
    assert client.post(f"/api/partner/bookings/{b['id']}/checkin",json={},headers=partner).status_code==200
    assert client.post(f"/api/partner/bookings/{b['id']}/checkin",json={},headers=partner).status_code==409
    month=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m')
    assert client.post('/api/admin/settlements/generate?period='+month,headers=admin,json={}).status_code==200
    assert client.post('/api/admin/settlements/generate?period='+month,headers=admin,json={}).status_code==200
    st=next(s for s in client.get('/api/settlements',headers=admin).json() if s['partner_id']==1)
    assert st['bookings']==1
    assert st['amount_cents']==b['payout_cents']
    assert client.get('/api/settlements',headers=partner).status_code==200
    assert client.get('/api/admin/audit',headers=partner).status_code==403

def test_admin_company_invoice_and_adjust():
    admin=auth('admin');employee=auth('employee')
    orig=client.get('/api/employee/summary',headers=employee).json()['balance']
    new=client.post('/api/admin/companies',headers=admin,json={'name':'QA Dummy Company','hr_email':'qa@example.test'})
    assert new.status_code==200
    plans=client.get('/api/admin/plans',headers=admin).json()
    invite=client.post('/api/admin/employees',headers=admin,json={'full_name':'QA User','email':'qa@demo.example','company_id':new.json()['id'],'plan_id':plans[0]['id']})
    assert invite.status_code==200 and invite.json()['status']=='INVITED'
    assert client.post('/api/auth/login',json={'email':'qa@demo.example','password':'InviteOnly!234'}).status_code==401
    invoice=client.post('/api/admin/invoices',headers=admin,json={'company_id':new.json()['id'],'period':'2026-10','reference':'QA-INV','amount_cents':123456})
    assert invoice.status_code==200
    assert client.post(f"/api/admin/invoices/{invoice.json()['id']}/status",headers=admin,json={'status':'PAID','payment_reference':'BANK-001'}).status_code==200
    users=client.get('/api/admin/employees',headers=admin).json()
    eid=next(x['id'] for x in users if x['email']=='employee@flexpass.demo')
    assert client.post('/api/admin/adjust-credits',headers=admin,json={'user_id':eid,'amount':-1000,'reason':'Invalid negative test'}).status_code==409
    assert client.get('/api/employee/summary',headers=employee).json()['balance']==orig

def test_last_seat_is_not_double_booked():
    """Two eligible employees racing for one seat yield one confirmed booking."""
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy import select
    from backend.app import Session, Service, Slot, User, Ledger, now
    admin=auth('admin')
    # Use a distinct test slot (capacity 1) and second active user.
    with Session() as s:
        svc=s.scalar(select(Service).where(Service.credits==5))
        assert svc is not None
        when=now()+__import__('datetime').timedelta(days=15)
        slot=Slot(service_id=svc.id,start_at=when,capacity=1,reserved=0)
        s.add(slot)
        # Existing fixture employee ID=2. Add another active employee via the test db.
        existing=s.scalar(select(User).where(User.email=='employee@flexpass.demo'))
        from backend.app import hash_pass
        other=User(email='racer@flexpass.demo',full_name='Racer',role='employee',password_hash=hash_pass('Race123!'),company_id=existing.company_id,plan_id=existing.plan_id,membership_status='ACTIVE')
        s.add(other);s.flush()
        s.add(Ledger(user_id=other.id,kind='ALLOCATION',amount=30,period=now().strftime('%Y-%m'),actor_id=1,reason='Race test'))
        sid=slot.id
        s.commit()
    e1=auth('employee')
    e2={'Authorization':'Bearer '+client.post('/api/auth/login',json={'email':'racer@flexpass.demo','password':'Race123!'}).json()['token']}
    def attempt(headers):return client.post('/api/bookings',json={'slot_id':sid},headers=headers).status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses=list(executor.map(attempt,[e1,e2]))
    assert sorted(statuses)==[200,409]
    with Session() as s:
        assert s.get(Slot,sid).reserved==1
