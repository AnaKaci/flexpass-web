"""Regression coverage for features transferred from the earlier FlexPass pilot."""
from datetime import timedelta
from backend.app import Session, User, Company, Plan, Slot, Service, now, hash_pass
from fastapi.testclient import TestClient
from backend.app import app
client=TestClient(app)
def auth(role):
    response=client.post('/api/auth/login',json={'email':f'{role}@flexpass.demo','password':'Demo123!'})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}
from sqlalchemy import select

def test_booking_idempotency_key_replays_once():
    employee = auth('employee')
    service = client.get('/api/catalog?group=wellness').json()[0]
    slot_id = service['slots'][-1]['id']
    headers = {**employee, 'Idempotency-Key': 'test-previous-demo-key'}
    first = client.post('/api/bookings', headers=headers, json={'slot_id': slot_id})
    assert first.status_code == 200, first.text
    second = client.post('/api/bookings', headers=headers, json={'slot_id': slot_id})
    assert second.status_code == 200
    assert second.json()['id'] == first.json()['id']
    other_slot = service['slots'][-2]['id']
    assert client.post('/api/bookings', headers=headers, json={'slot_id': other_slot}).status_code == 409

def test_company_hr_isolation_and_credit_changes():
    admin=auth('admin')
    with Session() as s:
        company=s.scalar(select(Company).where(Company.name=='Demo Tech Albania'))
        other=s.scalar(select(Company).where(Company.name=='Pilot Company'))
        plan=s.scalar(select(Plan))
        hr=s.scalar(select(User).where(User.email=='hr@flexpass.demo'))
        assert hr.company_id==company.id
        employee=s.scalar(select(User).where(User.email=='employee@flexpass.demo'))
        outsider=User(full_name='Other company employee',email='outside-hr-scope@example.test',
                     password_hash=hash_pass('TempPassword!123'),role='employee',company_id=other.id,
                     plan_id=plan.id,membership_status='ACTIVE')
        s.add(outsider)
        s.commit()
        own_id=employee.id
        other_id=outsider.id
        company_id=company.id
        other_company_id=other.id
        plan_id=plan.id
    hr_headers=auth('hr')
    summary=client.get('/api/hr/summary',headers=hr_headers)
    assert summary.status_code==200
    employees=client.get('/api/hr/employees',headers=hr_headers)
    assert employees.status_code==200
    assert all(e['company_id']==company_id for e in employees.json())
    assert client.get('/api/admin/companies',headers=hr_headers).status_code==403
    assert client.post('/api/hr/adjust-credits',headers=hr_headers,
        json={'user_id':other_id,'amount':1,'reason':'Cross company test'}).status_code==403
    assert client.post('/api/hr/adjust-credits',headers=hr_headers,
        json={'user_id':own_id,'amount':1,'reason':'HR correction'}).status_code==200
    assert client.post('/api/hr/employees',headers=hr_headers,
        json={'full_name':'Wrong scope','email':'wrong-scope@example.test',
              'company_id':other_company_id,'plan_id':plan_id}).status_code==403
    assert client.post('/api/hr/employees',headers=hr_headers,
        json={'full_name':'New colleague','email':'new-colleague@example.test',
              'company_id':company_id,'plan_id':plan_id}).status_code==200

def test_partner_payout_csv_access():
    partner=auth('partner')
    admin=auth('admin')
    employee=auth('employee')
    assert client.get('/api/partner/payouts/export',headers=partner).status_code==200
    assert client.get('/api/partner/payouts/export?start=invalid',headers=partner).status_code==400
    assert client.get('/api/partner/payouts/export',headers=employee).status_code==403
    assert client.get('/api/partner/payouts/export',headers=admin).status_code==403
    r=client.get('/api/partner/payouts/export',headers=partner)
    assert r.text.startswith('Booking reference,Service,Completed at (UTC),Credits,Partner payout (ALL),Status')
